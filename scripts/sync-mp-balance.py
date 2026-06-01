#!/usr/bin/env python3
"""
Sincroniza el SALDO REAL de Mercado Pago en el CRM, automáticamente.

MP no expone el saldo en un endpoint directo (da 403), pero el RELEASE REPORT
(que el token sí lee) trae una columna BALANCE_AMOUNT cuyo último valor = el
"Disponible" exacto de la app. El "a liberar" (próximos cobros) se deriva del
SETTLEMENT REPORT: liquidaciones cuya MONEY_RELEASE_DATE es futura.

Lo corre el workflow sync-ml.yml. Lee de env:
  MP_ACCESS_TOKEN  - token de producción de MP
  CRM_API_KEY      - Bearer del CRM (para POST /api/mp/real-balance)
  CRM_BASE         - https://echml.overcloud.us
"""
import os, sys, json, time, csv, io, datetime, urllib.request, urllib.parse

MP = "https://api.mercadopago.com"
TOKEN = os.environ["MP_ACCESS_TOKEN"]
KEY = os.environ["CRM_API_KEY"]
BASE = os.environ.get("CRM_BASE", "https://echml.overcloud.us")


def mp(method, path, body=None):
    req = urllib.request.Request(MP + path, method=method,
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "User-Agent": "echml-sync/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def mp_text(path):
    req = urllib.request.Request(MP + path,
        headers={"Authorization": f"Bearer {TOKEN}", "User-Agent": "echml-sync/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode("utf-8", "replace")


def gen_and_wait(kind, begin, end, max_wait=240):
    """Generate a release/settlement report and wait for THAT id, return CSV text."""
    posted = mp("POST", f"/v1/account/{kind}", {"begin_date": begin, "end_date": end})
    rid = str(posted.get("id"))
    print(f"  {kind} id={rid} generating...")
    deadline = time.time() + max_wait
    while time.time() < deadline:
        time.sleep(10)
        lst = mp("GET", f"/v1/account/{kind}/list")
        match = [x for x in lst if str(x.get("id")) == rid]
        if match and match[0].get("status") in ("enabled", "processed"):
            fn = match[0]["file_name"]
            return mp_text(f"/v1/account/{kind}/{fn}")
    raise TimeoutError(f"{kind} {rid} no quedó listo a tiempo")


def parse_disponible(csv_text):
    """Last non-empty BALANCE_AMOUNT in the release report = Disponible."""
    rdr = csv.DictReader(io.StringIO(csv_text), delimiter=";")
    bal = None
    for row in rdr:
        b = (row.get("BALANCE_AMOUNT") or "").strip()
        d = (row.get("DATE") or "").strip()
        if b and d:
            bal = float(b)
    return bal


def parse_a_liberar(csv_text):
    """Sum REAL_AMOUNT of settlements whose MONEY_RELEASE_DATE is still in the future."""
    now = datetime.datetime.now(datetime.timezone.utc)
    rdr = csv.DictReader(io.StringIO(csv_text), delimiter=";")
    total = 0.0
    for row in rdr:
        mrd = (row.get("MONEY_RELEASE_DATE") or "").strip()
        amt = (row.get("REAL_AMOUNT") or "").strip()
        if not mrd or not amt:
            continue
        try:
            rel = datetime.datetime.fromisoformat(mrd.replace("Z", "+00:00"))
        except Exception:
            continue
        if rel > now:
            total += float(amt)
    return round(total, 2)


def main():
    today = datetime.date.today()
    begin = (today - datetime.timedelta(days=40)).strftime("%Y-%m-%dT00:00:00.000-06:00")
    end = (today + datetime.timedelta(days=1)).strftime("%Y-%m-%dT23:59:59.999-06:00")

    print("Release report (disponible)...")
    disp = parse_disponible(gen_and_wait("release_report", begin, end))
    print(f"  DISPONIBLE = {disp}")

    futuro = 0.0
    try:
        print("Settlement report (a liberar)...")
        futuro = parse_a_liberar(gen_and_wait("settlement_report", begin, end))
        print(f"  A LIBERAR = {futuro}")
    except Exception as e:
        print(f"  (a liberar no disponible: {e}; se deja en 0)")

    if disp is None:
        print("No se pudo leer el disponible; aborto sin escribir.")
        sys.exit(1)

    body = json.dumps({"disponible": disp, "futuro": max(0.0, futuro),
                       "note": "Auto desde release/settlement report de MP"}).encode()
    req = urllib.request.Request(f"{BASE}/api/mp/real-balance", data=body, method="POST",
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "User-Agent": "curl/8"})
    with urllib.request.urlopen(req, timeout=60) as r:
        print("CRM actualizado:", r.read().decode()[:300])


if __name__ == "__main__":
    main()
