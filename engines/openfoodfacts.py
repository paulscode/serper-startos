# SPDX-License-Identifier: AGPL-3.0-or-later
"""Open Food Facts - Product search engine for food products

This engine searches the Open Food Facts database, a free and open database
of food products from around the world with ingredients, nutrition facts, etc.

API Documentation: https://wiki.openfoodfacts.org/API
"""

from urllib.parse import urlencode

about = {
    "website": "https://world.openfoodfacts.org/",
    "wikidata_id": "Q19507243",
    "official_api_documentation": "https://wiki.openfoodfacts.org/API",
    "use_official_api": True,
    "require_api_key": False,
    "results": "JSON",
}

categories = ['shopping', 'food']
paging = True
page_size = 20

# Base URL
base_url = "https://world.openfoodfacts.org"
search_url = base_url + "/cgi/search.pl"


def request(query, params):
    """Build the search request for Open Food Facts API"""
    
    args = {
        'search_terms': query,
        'search_simple': 1,
        'action': 'process',
        'json': 1,
        'page_size': page_size,
        'page': params['pageno'],
        # Sort by popularity (most scanned products first)
        'sort_by': 'unique_scans_n',
    }
    
    params['url'] = f"{search_url}?{urlencode(args)}"
    
    return params


def response(resp):
    """Parse the Open Food Facts API response"""
    results = []
    
    try:
        json_data = resp.json()
    except Exception:
        return results
    
    products = json_data.get('products', [])
    
    for product in products:
        # Skip products without required fields
        product_name = product.get('product_name') or product.get('product_name_en')
        if not product_name:
            continue
        
        code = product.get('code', '')
        product_url = f"{base_url}/product/{code}" if code else None
        
        if not product_url:
            continue
        
        # Get the best available image
        thumbnail = (
            product.get('image_front_small_url') or 
            product.get('image_small_url') or
            product.get('image_front_url') or
            product.get('image_url')
        )
        
        # Build content from available information
        content_parts = []
        
        # Brand
        brands = product.get('brands')
        if brands:
            content_parts.append(f"Brand: {brands}")
        
        # Quantity
        quantity = product.get('quantity')
        if quantity:
            content_parts.append(f"Size: {quantity}")
        
        # Categories (shortened)
        categories_str = product.get('categories')
        if categories_str:
            # Take first 2 categories to keep it brief
            cats = categories_str.split(',')[:2]
            content_parts.append(f"Category: {', '.join(c.strip() for c in cats)}")
        
        # Nutrition grade
        nutriscore = product.get('nutriscore_grade') or product.get('nutrition_grades')
        if nutriscore and nutriscore.lower() in ['a', 'b', 'c', 'd', 'e']:
            content_parts.append(f"Nutri-Score: {nutriscore.upper()}")
        
        # Nova group (food processing level)
        nova = product.get('nova_group')
        if nova:
            nova_labels = {
                1: "Unprocessed",
                2: "Processed culinary",
                3: "Processed",
                4: "Ultra-processed"
            }
            nova_label = nova_labels.get(int(nova), f"Group {nova}")
            content_parts.append(f"NOVA: {nova_label}")
        
        # Ingredients preview
        ingredients = product.get('ingredients_text') or product.get('ingredients_text_en')
        if ingredients and len(ingredients) > 100:
            ingredients = ingredients[:100] + "..."
        if ingredients:
            content_parts.append(f"Ingredients: {ingredients}")
        
        # Countries where sold
        countries = product.get('countries')
        if countries:
            # Limit to first 3 countries
            country_list = countries.split(',')[:3]
            countries_preview = ', '.join(c.strip() for c in country_list)
            if len(product.get('countries', '').split(',')) > 3:
                countries_preview += '...'
            content_parts.append(f"Available in: {countries_preview}")
        
        content = ' | '.join(content_parts) if content_parts else None
        
        # Build the result
        result = {
            'url': product_url,
            'title': product_name,
            'content': content,
            'thumbnail': thumbnail,
            # Use the products template for shopping results
            'template': 'products.html',
        }
        
        # Add price-like info (use nutrition as proxy since Open Food Facts doesn't have prices)
        # For shopping context, we show the product code as an identifier
        if code:
            result['price'] = f"Barcode: {code}"
        
        # Source information
        result['source'] = 'Open Food Facts'
        
        results.append(result)
    
    return results
