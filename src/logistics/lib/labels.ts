import { code128Svg } from "./barcode";
import { formatAddress, SERVICE_LEVELS, type Shipment } from "./db";

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Open a print window with one 100×150 mm label per shipment. */
export function printLabels(shipments: Shipment[]) {
  if (!shipments.length) return;
  const w = window.open("", "_blank", "width=480,height=720");
  if (!w) return;

  const pieces = shipments.flatMap((s) =>
    Array.from({ length: Math.max(1, s.parcel_count || 1) }, (_, i) => ({ s, n: i + 1, of: Math.max(1, s.parcel_count || 1) })),
  );
  const labels = pieces
    .map(
      ({ s, n, of }) => `<section class="l">
  <div class="top"><span>1145 LOGISTICS</span><span class="svc">${esc(SERVICE_LEVELS[s.service_level])}</span></div>
  <div class="bc">${code128Svg(`${s.tracking_number}-${n}`, { height: 70, module: 2 })}</div>
  <div class="tn">${esc(s.tracking_number)}<span class="pc">${n}/${of}</span></div>
  <div class="k">Deliver to</div>
  <div class="big">${esc(s.recipient_name)}</div>
  <div class="v">${esc(formatAddress(s.delivery_address))}${s.recipient_phone ? `<br>${esc(s.recipient_phone)}` : ""}</div>
  <div class="row">
    <div><div class="k">From</div><div class="v">${esc(s.sender_name)}</div></div>
    <div><div class="k">Piece</div><div class="v">${n} of ${of}${s.weight_kg ? ` · ${s.weight_kg} kg total` : ""}</div></div>
  </div>
  ${s.cod_amount ? `<div class="cod">COLLECT R ${Number(s.cod_amount).toFixed(2)}</div>` : ""}
  ${s.reference ? `<div class="k">Ref</div><div class="v">${esc(s.reference)}</div>` : ""}
</section>`,
    )
    .join("");

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Labels (${pieces.length})</title>
<style>
  @page { size: 100mm 150mm; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #000; }
  .l { width: 100mm; height: 150mm; padding: 6mm; page-break-after: always; display: flex; flex-direction: column; gap: 1.5mm; }
  .top { display: flex; justify-content: space-between; font-weight: 700; font-size: 11px; letter-spacing: 1px; border-bottom: 2px solid #000; padding-bottom: 2mm; }
  .svc { border: 2px solid #000; padding: 0 4px; }
  .bc svg { width: 100%; height: 22mm; }
  .tn { font: 700 20px ui-monospace, monospace; letter-spacing: 3px; text-align: center; margin-bottom: 2mm; }
  .pc { margin-left: 3mm; border: 2px solid #000; padding: 0 4px; letter-spacing: 0; }
  .k { font-size: 9px; text-transform: uppercase; color: #444; letter-spacing: .5px; }
  .v { font-size: 13px; }
  .big { font-size: 20px; font-weight: 700; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 2mm; }
  .cod { margin-top: auto; border: 3px solid #000; text-align: center; font-weight: 800; font-size: 18px; padding: 2mm; }
</style></head><body>${labels}<script>window.onload=()=>{window.print()}</script></body></html>`);
  w.document.close();
}
