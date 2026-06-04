#!/usr/bin/env python3
"""One-shot builder: create the 4 TikTok Shop playera-normal products.

Uploads hi-res ML images to TikTok, then creates Single / 3-pack / 4-pack /
6-pack products with full color x size variant grids. Idempotent-ish: prints
created product ids. Run after /api/tiktok/upload-picture is deployed.
"""
import json, urllib.request, sys, subprocess, tempfile, os

BASE = "https://echml.overcloud.us"
KEY = "ech_caa7d736-42b4-4a2a-a83d-af84495074c7"
WAREHOUSE = "7582429721099585301"
CATEGORY = "601226"  # Camisetas (men's t-shirts), MX

def _post(path, payload):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"_http_error": e.code, "body": e.read().decode()[:800]}

def proxy(method, path, body=None, skip_cipher=False):
    p = {"method": method, "path": path}
    if body is not None:
        p["body"] = body
    if skip_cipher:
        p["skipShopCipher"] = True
    return _post("/api/tiktok/proxy", p)

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"

def upload(url, use_case="MAIN_IMAGE"):
    # Download locally (residential IP bypasses ML Cloudflare), then upload bytes.
    tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False).name
    subprocess.run(["curl", "-s", "-A", UA, url, "-o", tmp], check=True)
    if os.path.getsize(tmp) < 2000:
        print("  DOWNLOAD TOO SMALL:", url); sys.exit(1)
    out = subprocess.run(
        ["curl", "-s", "-X", "POST", BASE + "/api/tiktok/upload-picture",
         "-H", f"Authorization: Bearer {KEY}",
         "-F", f"file=@{tmp};type=image/jpeg", "-F", f"useCase={use_case}"],
        capture_output=True, text=True,
    ).stdout
    os.unlink(tmp)
    try:
        r = json.loads(out)
    except Exception:
        print("  UPLOAD BAD RESPONSE:", out[:300]); sys.exit(1)
    uri = r.get("uri") or (r.get("data") or {}).get("uri")
    if not uri:
        print("  UPLOAD FAILED:", url, "->", out[:300]); sys.exit(1)
    return uri

F = lambda u: u  # urls already -F

# ---- image sources (1024x1024 ML) ----
IMG = {
  "hero_blanco": "https://http2.mlstatic.com/D_675672-MLM111519885326_062026-F.jpg",
  "hero_gris":   "https://http2.mlstatic.com/D_794050-MLM112580967473_062026-F.jpg",
  "hero_negro":  "https://http2.mlstatic.com/D_719931-MLM112580967441_062026-F.jpg",
  "info_detalles":"https://http2.mlstatic.com/D_999728-MLM112577820125_062026-F.jpg",
  "info_3colors":"https://http2.mlstatic.com/D_870065-MLM111517251524_062026-F.jpg",
  "life1":       "https://http2.mlstatic.com/D_781401-MLM111516901196_062026-F.jpg",
  "life2":       "https://http2.mlstatic.com/D_969507-MLM112577612521_062026-F.jpg",
}

print("Uploading images to TikTok ...")
URI = {}
for k, url in IMG.items():
    uc = "ATTRIBUTE_IMAGE" if k.startswith("hero") else "MAIN_IMAGE"
    URI[k] = upload(url, uc)
    print(f"  {k}: {URI[k]}")

# color -> (hero key, sku code, value_name)
COLORS_BASE = [("hero_blanco","BLA","Blanco"), ("hero_gris","GRI","Gris"), ("hero_negro","NEG","Negro")]
MULTI = ("info_3colors","MUL","Multicolor")
SIZES = [("S","S"),("M","M"),("L","L"),("XL","XL")]

SIZE_CHART = (
  "<p><b>Guia de tallas (cm):</b></p>"
  "<p>S: Pecho 54-58, Largo 72-74<br>"
  "M: Pecho 58-62, Largo 74-76<br>"
  "L: Pecho 62-66, Largo 76-78<br>"
  "XL: Pecho 66-70, Largo 78-80</p>"
)
FEATURES = (
  "<p>Playera para hombre 100% algodon premium, manga corta, cuello redondo "
  "reforzado con doble costura. Corte comodo, tacto suave y material resistente. "
  "Facil de lavar. Disponible en Blanco, Gris y Negro.</p>"
)

ATTRS = [
  {"id":"100157","values":[{"id":"1000039"}]},  # Algodon
  {"id":"100393","values":[{"id":"1001126"}]},  # Cuello redondo
  {"id":"100395","values":[{"id":"1001141"}]},  # Manga corta
  {"id":"100398","values":[{"id":"1001165"}]},  # Basico
  {"id":"100198","values":[{"id":"1001182"}]},  # Color solido
  {"id":"101127","values":[{"id":"1005904"}]},  # Tipo de tamano Normal
  {"id":"100399","values":[{"id":"1001180"}]},  # Ajuste Equipado
]
PACKQTY_VAL = {1:"1000256", 3:"1000258", 4:"1000347", 6:"1000638"}

def build_product(name, pack, price, colors, stock, weight, dims):
    main_imgs = [{"uri":URI["hero_blanco"]},{"uri":URI["info_detalles"]},
                 {"uri":URI["info_3colors"]},{"uri":URI["life1"]},{"uri":URI["life2"]}]
    attrs = ATTRS + [{"id":"100347","values":[{"id":PACKQTY_VAL[pack]}]}]
    skus = []
    for herok, ccode, cname in colors:
        for scode, sname in SIZES:
            skus.append({
                "sales_attributes":[
                    {"id":"100000","name":"Color","value_name":cname,"sku_img":{"uri":URI[herok]}},
                    {"id":"100007","name":"Talla","value_name":sname},
                ],
                "seller_sku": f"NOOS-TT-{pack}-{ccode}-{scode}",
                "price": {"amount": str(price), "currency": "MXN"},
                "inventory": [{"warehouse_id": WAREHOUSE, "quantity": stock}],
            })
    payload = {
        "save_mode":"LISTING",
        "product_name": name,
        "description": FEATURES + SIZE_CHART,
        "category_id": CATEGORY,
        "main_images": main_imgs,
        "package_weight": {"value": weight, "unit":"KILOGRAM"},
        "package_dimensions": {"length":dims[0],"width":dims[1],"height":dims[2],"unit":"CENTIMETER"},
        "product_attributes": attrs,
        "skus": skus,
    }
    print(f"\nCreating: {name}  ({len(skus)} SKUs @ ${price})")
    r = proxy("POST", "/product/202309/products", payload)
    print("  ->", json.dumps(r)[:600])
    return r

# ---- the 4 products ----
build_product("Playera Hombre Manga Corta Algodon Premium Cuello Redondo",
              1, 149, COLORS_BASE, 20, "0.3", ("25","20","3"))
build_product("Pack 3 Playeras Hombre Algodon Premium Manga Corta",
              3, 369, COLORS_BASE+[MULTI], 8, "0.9", ("25","25","8"))
build_product("Pack 4 Playeras Hombre Algodon Premium Manga Corta",
              4, 479, COLORS_BASE+[MULTI], 6, "1.1", ("28","25","9"))
build_product("Pack 6 Playeras Hombre Algodon Premium Mayoreo",
              6, 649, COLORS_BASE+[MULTI], 4, "1.6", ("30","28","12"))
print("\nDONE.")
