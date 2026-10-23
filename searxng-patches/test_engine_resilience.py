"""Exercise engine_resilience against stand-ins shaped like SearXNG's own.

    python3 searxng-patches/test_engine_resilience.py

Stand-ins rather than a running SearXNG, because the two behaviours worth
proving are both about our patch: that a missing engine is skipped instead of
raising, and that a failed engine rejoins on its own once its upstream is back.
The fakes mirror the real shapes -- ProcessorMap is a dict subclass with a
register_processor callback, initialize() runs the init off-thread -- so a
change in those shapes is what should break this test.
"""
import sys, types, time, threading, pathlib
sys.path.insert(0, str(pathlib.Path.home() / "workspace/serper-startos/searxng-patches"))

# --- stand-ins that mirror the real classes closely enough to be a fair test ---
class EngineProcessor:
    def __init__(self, eng): self.engine = eng
    def initialize(self, cb):
        ok = self.engine.init_ok
        threading.Thread(target=lambda: cb(self, ok), daemon=True).start()
    def extend_container_if_suspended(self, rc): return False
    def get_params(self, sq, cat): return {"real": True}

class ProcessorMap(dict):
    processor_types = {"online": EngineProcessor}
    def register_processor(self, proc, ok):
        if ok: self[proc.engine.name] = proc
        return ok

class Eng:
    engine_type = "online"
    def __init__(self, name, init_ok): self.name, self.init_ok = name, init_ok

PROCESSORS = ProcessorMap()
engines = {"good": Eng("good", True), "wikidata": Eng("wikidata", False)}
PROCESSORS.register_processor(EngineProcessor(engines["good"]), True)

procs = types.ModuleType("searx.search.processors"); procs.PROCESSORS = PROCESSORS
engmod = types.ModuleType("searx.engines"); engmod.engines = engines
searx = types.ModuleType("searx"); searx.settings = {"engines": [{"name": "good"}, {"name": "wikidata"}]}
search_pkg = types.ModuleType("searx.search")
for n, m in [("searx", searx), ("searx.search", search_pkg),
             ("searx.search.processors", procs), ("searx.engines", engmod)]:
    sys.modules[n] = m

import engine_resilience as er
er.RETRY_SECONDS = 1

print("BEFORE the patch")
try:
    PROCESSORS["wikidata"]; print("  FAIL: no KeyError")
except KeyError:
    print("  KeyError('wikidata')  <- this is what 500s every search")

er._install()
time.sleep(0.3)

print("\nAFTER the patch")
stub = PROCESSORS["wikidata"]
print(f"  lookup returns   : {stub!r}")
print(f"  search loop skips: {stub.extend_container_if_suspended(None) is True}")
print(f"  healthy engine   : {PROCESSORS['good'].get_params(None, None)}  <- unaffected")

print("\nSELF-HEAL: wikidata's upstream comes back")
engines["wikidata"].init_ok = True
time.sleep(2.5)
ok = "wikidata" in PROCESSORS and isinstance(PROCESSORS["wikidata"], EngineProcessor)
print(f"  re-registered by itself: {ok}")
print(f"  now returns a real processor: {PROCESSORS['wikidata'].get_params(None, None)}")
print("\nRESULT:", "PASS" if ok else "FAIL")
