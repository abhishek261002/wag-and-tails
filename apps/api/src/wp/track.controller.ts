import { Controller, Get, Header, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoutingService } from '../routing/routing.service.js';

// B7: the live-tracking page a website customer opens from the WhatsApp "on the way" message. No app or login: the
// link's random token is the key. It shows the groomer, the job's progress, the groomer's position while they are
// on the way, and an ETA. The link stops showing a position once the job is finished.

const LABEL: Record<string, string> = {
  needs_partner: 'Finding your groomer', confirmed: 'Booking confirmed', assigned: 'Groomer confirmed', accepted: 'Groomer confirmed',
  partner_on_the_way: 'On the way', arrived: 'Arrived at your door', in_progress: 'Grooming in progress', completed: 'Grooming complete',
  cancelled: 'Booking cancelled', refunded: 'Booking cancelled',
};
const ACTIVE = ['assigned', 'accepted', 'partner_on_the_way', 'arrived', 'in_progress'];

@ApiExcludeController()
@Controller('track')
export class TrackController {
  constructor(private prisma: PrismaService, private routing: RoutingService) {}

  @Get(':token/data')
  @Header('Cache-Control', 'no-store')
  async data(@Param('token') token: string) {
    if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) throw new NotFoundException();
    const b = await this.prisma.booking.findUnique({
      where: { trackToken: token },
      include: { address: true, partner: { include: { user: { include: { profile: true } } } } },
    });
    if (!b) throw new NotFoundException('This tracking link is not valid');
    const moving = b.status === 'partner_on_the_way';
    const p = b.partner;
    let etaMins: number | null = null;
    if (moving && p?.currentLat != null && p.currentLng != null && b.address && b.address.lat !== 0) {
      try {
        const r = await this.routing.getRoute({ lat: p.currentLat, lng: p.currentLng }, { lat: b.address.lat, lng: b.address.lng });
        etaMins = Math.max(1, Math.round(r.durationSeconds / 60));
      } catch {
        etaMins = null;
      }
    }
    return {
      ref: b.wpRef,
      status: b.status,
      label: LABEL[b.status] ?? b.status,
      scheduledAt: b.scheduledAt,
      pet: b.petName,
      package: b.packageName,
      groomer: p && ACTIVE.concat('completed').includes(b.status)
        ? {
            name: p.user?.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}`.trim() : 'Your groomer',
            photo: p.photoUrl ?? p.user?.profile?.avatarUrl ?? null,
            rating: Number(p.rating ?? 0),
            phone: ACTIVE.includes(b.status) ? p.user?.phone ?? null : null,
          }
        : null,
      position: moving && p?.currentLat != null ? { lat: p.currentLat, lng: p.currentLng, at: p.lastSeenAt } : null,
      home: ACTIVE.includes(b.status) && b.address && b.address.lat !== 0 ? { lat: b.address.lat, lng: b.address.lng } : null,
      etaMins,
    };
  }

  @Get(':token')
  page(@Param('token') token: string, @Res() res: any) {
    if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) throw new NotFoundException();
    res
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Cache-Control', 'no-store')
      .header('X-Robots-Tag', 'noindex')
      .header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https:; connect-src 'self'")
      .send(PAGE.replace('__TOKEN__', token));
  }
}

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Track your groomer · Wag &amp; Tails</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
:root{--bg:#FFF8F1;--card:#fff;--ink:#2B1A0E;--muted:#7A6A5E;--brand:#4B1D00;--accent:#F28C28;--ok:#2E7D32;--line:#EFE3D6}
@media (prefers-color-scheme:dark){:root{--bg:#1B140F;--card:#241B15;--ink:#F6EDE4;--muted:#B9A99B;--line:#3A2E25}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:560px;margin:0 auto;padding:16px}
h1{font-size:18px;margin:4px 0 12px;color:var(--brand)}@media (prefers-color-scheme:dark){h1{color:var(--accent)}}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:12px}
.status{font-size:22px;font-weight:700}.eta{color:var(--accent);font-weight:700;margin-top:4px}
.muted{color:var(--muted);font-size:14px}.row{display:flex;gap:12px;align-items:center}
.ph{width:56px;height:56px;border-radius:50%;object-fit:cover;background:var(--line)}
.btn{display:inline-block;margin-top:10px;padding:10px 16px;border-radius:999px;background:var(--brand);color:#fff;text-decoration:none;font-weight:600}
#map{height:320px;border-radius:16px;border:1px solid var(--line);display:none;margin-bottom:12px}
.steps{display:flex;gap:6px;margin-top:12px}.steps span{flex:1;height:6px;border-radius:3px;background:var(--line)}.steps span.on{background:var(--accent)}
</style></head><body><div class="wrap">
<h1>Wag &amp; Tails · Grooming</h1>
<div class="card"><div class="muted" id="ref"></div><div class="status" id="label">Loading…</div><div class="eta" id="eta"></div>
<div class="steps"><span></span><span></span><span></span><span></span><span></span></div></div>
<div id="map"></div>
<div class="card" id="groomer" style="display:none"><div class="row"><img class="ph" id="gph" alt=""><div><div id="gname" style="font-weight:700"></div><div class="muted" id="grate"></div></div></div><a class="btn" id="gcall" style="display:none">Call groomer</a></div>
<div class="card muted" id="when"></div>
<p class="muted">Share your start code with the groomer only when they arrive at your door.</p>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var T='__TOKEN__',map,me,home,ORDER=['assigned','partner_on_the_way','arrived','in_progress','completed'];
function el(i){return document.getElementById(i)}
function draw(d){
 el('ref').textContent=d.ref?('Booking '+d.ref):'';el('label').textContent=d.label;
 el('eta').textContent=d.etaMins?('Arriving in about '+d.etaMins+' min'):'';
 var k=d.status==='accepted'?'assigned':d.status,ix=ORDER.indexOf(k);
 document.querySelectorAll('.steps span').forEach(function(s,i){s.className=i<=ix?'on':''});
 if(d.scheduledAt){el('when').textContent=(d.package||'Grooming')+' for '+(d.pet||'your pet')+' · '+new Date(d.scheduledAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}
 if(d.groomer){el('groomer').style.display='block';el('gname').textContent=d.groomer.name;el('grate').textContent=d.groomer.rating?('★ '+d.groomer.rating.toFixed(1)):'';
  if(d.groomer.photo){el('gph').src=d.groomer.photo}else{el('gph').style.visibility='hidden'}
  if(d.groomer.phone){el('gcall').href='tel:'+d.groomer.phone;el('gcall').style.display='inline-block'}else{el('gcall').style.display='none'}}
 if(d.position&&window.L){el('map').style.display='block';
  if(!map){map=L.map('map');L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map)}
  var p=[d.position.lat,d.position.lng];if(!me){me=L.circleMarker(p,{radius:9,color:'#F28C28',fillOpacity:.9}).addTo(map)}else{me.setLatLng(p)}
  if(d.home){if(!home){home=L.marker([d.home.lat,d.home.lng]).addTo(map)}map.fitBounds(L.latLngBounds([p,[d.home.lat,d.home.lng]]).pad(.3))}else{map.setView(p,15)}
 }else{el('map').style.display='none'}
}
function load(){fetch(T+'/data',{cache:'no-store'}).then(function(r){if(!r.ok)throw r;return r.json()}).then(function(d){draw(d);var done=['completed','cancelled','refunded'].indexOf(d.status)>=0;if(!done)setTimeout(load,15000)}).catch(function(){el('label').textContent='This tracking link is not valid.'})}
load();
</script></body></html>`;
