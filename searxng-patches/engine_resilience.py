"""Keep one sick engine from taking down every search, and let it come back.

THE FAILURE THIS EXISTS FOR, observed 2026-08-17 on this instance:

  ERROR:searx.searx.search.processor: Init method of engine wikidata failed
  ...
  File "/usr/local/searxng/searx/engines/wikidata.py", line 803, in init
      jsonresponse = send_wikidata_query(query, timeout=20)

`wikidata`'s ``init()`` makes a live SPARQL request to query.wikidata.org while
SearXNG is starting. That request did not come back, so
``ProcessorMap.register_processor`` declined to register the engine. But the
engine stays in the *enabled* list regardless, and ``Search._get_requests`` does
a bare ``PROCESSORS[engineref.name]`` for every enabled engine. One KeyError
later, the whole request is a 500 -- not the wikidata part of it, all of it.

Every search on this instance failed for two days for that reason, and the
bridge's ``/health`` stayed green throughout because SearXNG was serving its
home page perfectly well the entire time.

Two things are wrong there and this module fixes both, without editing a line of
upstream SearXNG:

1. **A missing processor is not fatal.** ``ProcessorMap`` is a plain ``dict``
   subclass, so ``__missing__`` is the hook Python already calls on a missing
   key. It returns a stub that answers ``True`` to
   ``extend_container_if_suspended``, which is the branch ``_get_requests``
   already uses to skip an engine cleanly. The other engines answer normally, the
   search succeeds, and the sick engine simply contributes nothing.

2. **A failed engine is retried, so it heals itself.** ``initialize()`` is
   re-callable and ``register_processor`` is idempotent, so a background thread
   re-runs initialisation for any enabled-but-unregistered engine on an interval.
   When query.wikidata.org is reachable again, wikidata registers on the next
   sweep and rejoins without anybody restarting anything.

Deliberately NOT done: removing wikidata from ``settings.yml``. That fixes this
week and ships the next release without an engine somebody may want, and it does
nothing at all for the next engine that fails the same way.

Installed via a ``.pth`` file so no upstream file is edited, which means a
SearXNG upgrade cannot silently drop the patch on the floor -- if the internals
this relies on ever move, the guard in ``_install`` logs and gives up rather than
breaking start-up.

Tunables, both environment variables:
  SEARXNG_ENGINE_RETRY_SECONDS   how often to retry failed engines (default 300)
  SEARXNG_ENGINE_RETRY_DISABLE   set to 1 to switch the retry loop off entirely
"""

from __future__ import annotations

import logging
import os
import threading
import time

log = logging.getLogger("searx.engine_resilience")

RETRY_SECONDS = int(os.environ.get("SEARXNG_ENGINE_RETRY_SECONDS", "300") or 300)
RETRY_DISABLED = os.environ.get("SEARXNG_ENGINE_RETRY_DISABLE", "") == "1"

# How long to wait for searx to become importable before giving up. The .pth
# runs at interpreter start, long before searx has finished importing itself.
_WAIT_TIMEOUT = 120
_WAIT_STEP = 0.5

_lock = threading.Lock()
_installed = False
# Engine name -> how many times we have complained about it, so a permanently
# broken engine costs one line a sweep at first and then falls quiet. A log that
# scrolls is a log nobody reads.
_complained: dict[str, int] = {}


class _SkippedProcessor:
    """Stands in for an engine that failed to initialise.

    Returning this rather than raising is what turns a fatal search into a
    partial one. ``_get_requests`` calls ``extend_container_if_suspended`` first
    and skips the engine when it answers True, which is exactly the behaviour
    wanted here: no request is built, no timeout is contributed, and the engine
    is absent from the results instead of the results being absent.
    """

    __slots__ = ("name",)

    def __init__(self, name: str):
        self.name = name

    def extend_container_if_suspended(self, _result_container) -> bool:
        return True

    def get_params(self, _search_query, _category):
        return None

    def __repr__(self) -> str:
        return f"<engine {self.name!r} unavailable: init failed>"


def _retry_failed_engines(processors_mod, engines_mod) -> int:
    """Re-initialise every enabled engine that is not currently registered.

    Returns the number of engines that came back. Runs on a timer, so it must
    never raise: an exception here would kill the thread and take the self-
    healing with it, silently, which is the same class of bug it exists to fix.
    """
    from searx import settings  # imported late: settings load after this module

    recovered = 0
    registry = processors_mod.PROCESSORS
    for eng_settings in settings.get("engines") or []:
        name = eng_settings.get("name")
        if not name or eng_settings.get("inactive", False) is True:
            continue
        if name in registry:
            continue

        eng_obj = engines_mod.engines.get(name)
        if eng_obj is None:
            continue  # not a real engine; ProcessorMap.init already said so

        eng_type = getattr(eng_obj, "engine_type", "online")
        proc_cls = registry.processor_types.get(eng_type)
        if proc_cls is None:
            continue

        seen = _complained.get(name, 0)
        if seen < 3:
            log.info("engine %r is not registered; retrying its init", name)
            _complained[name] = seen + 1

        try:
            # Same call ProcessorMap.init makes. initialize() runs init in its
            # own thread and calls back into register_processor, which only
            # registers on success, so a still-broken engine changes nothing.
            proc_cls(eng_obj).initialize(registry.register_processor)
        except Exception:  # noqa: BLE001 - a timer thread may not die
            log.exception("retrying engine %r raised", name)
            continue

        # initialize() is asynchronous, so this sweep cannot confirm the result.
        # The next sweep sees it in the registry and stops retrying, which is the
        # only confirmation needed.
        recovered += 1
    return recovered


def _loop(processors_mod, engines_mod) -> None:
    while True:
        time.sleep(RETRY_SECONDS)
        try:
            _retry_failed_engines(processors_mod, engines_mod)
        except Exception:  # noqa: BLE001
            log.exception("engine retry sweep failed; will try again")


def _install() -> None:
    global _installed

    deadline = time.monotonic() + _WAIT_TIMEOUT
    processors_mod = engines_mod = None
    while time.monotonic() < deadline:
        try:
            from searx.search import processors as processors_mod  # type: ignore[no-redef]
            from searx import engines as engines_mod  # type: ignore[no-redef]

            if getattr(processors_mod, "PROCESSORS", None) is not None:
                break
        except Exception:  # noqa: BLE001 - searx is still coming up
            pass
        time.sleep(_WAIT_STEP)

    if processors_mod is None or getattr(processors_mod, "PROCESSORS", None) is None:
        log.warning("searx.search.processors never became importable; "
                    "engine resilience is NOT active")
        return

    with _lock:
        if _installed:
            return

        cls = type(processors_mod.PROCESSORS)
        if not isinstance(processors_mod.PROCESSORS, dict):
            # The internals moved. Say so loudly and change nothing: a start-up
            # this patch breaks is worse than the bug it is here to prevent.
            log.warning("ProcessorMap is no longer a dict subclass; engine "
                        "resilience is NOT active")
            return

        def __missing__(_self, key: str):  # noqa: N807
            if _complained.get(key, 0) < 3:
                log.warning("engine %r has no processor (its init failed); "
                            "skipping it for this search rather than failing "
                            "the whole request", key)
            return _SkippedProcessor(key)

        cls.__missing__ = __missing__
        _installed = True
        log.info("engine resilience active: a failed engine is skipped, not fatal")

        if not RETRY_DISABLED:
            threading.Thread(
                target=_loop, args=(processors_mod, engines_mod),
                name="engine-resilience-retry", daemon=True,
            ).start()
            log.info("engine retry sweep every %ss", RETRY_SECONDS)


_fork_hook_registered = False


def _start_thread() -> None:
    threading.Thread(target=_install, name="engine-resilience-install",
                     daemon=True).start()


def _after_fork_in_child() -> None:
    # Threads do not survive fork(). SearXNG runs under granian, whose main
    # process reads this .pth and then forks the workers that actually import
    # searx and serve searches, so a thread started only here would wait in a
    # process that never loads searx while the workers run unpatched. Start a
    # fresh install thread in each child. A class patch made before the fork is
    # inherited; re-installing is harmless and also starts this child's retry
    # sweep.
    global _installed
    _installed = False
    _start_thread()


def start() -> None:
    """Entry point. Returns immediately; the wait for searx happens off-thread."""
    global _fork_hook_registered
    if not _fork_hook_registered and hasattr(os, "register_at_fork"):
        os.register_at_fork(after_in_child=_after_fork_in_child)
        _fork_hook_registered = True
    _start_thread()
