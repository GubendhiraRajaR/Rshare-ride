/* app.js - RShare
   Shared logic for index.html, rider.html, driver.html
   Storage keys used:
     - r_rider_requests (array)  -- requests created by riders
     - r_driver_posts  (array)    -- empty rides posted by drivers
     - r_history      (array)     -- completed rides
     - r_profile      (object)    -- driver profile (optional)
*/

(function(){
  // -------------------------
  // Particle background (shared)
  // -------------------------
  const canvas = document.getElementById('bgCanvas');
  if(canvas){
    const ctx = canvas.getContext('2d'); let w,h,parts=[];
    function rand(a,b){return Math.random()*(b-a)+a}
    function resize(){ w = canvas.width = innerWidth; h = canvas.height = innerHeight; init(); }
    function init(){ parts = []; const count = Math.max(18, Math.round((w*h)/90000)); for(let i=0;i<count;i++){ parts.push({ x: rand(0,w), y: rand(0,h), r: rand(0.8,3.2), vx: rand(-0.2,0.2), vy: rand(-0.06,0.06), hue: rand(160,200), alpha: rand(0.06,0.32) }); } }
    function grad(){ const g = ctx.createLinearGradient(0,0,w,h); g.addColorStop(0,'rgba(1,36,33,0.06)'); g.addColorStop(0.6,'rgba(0,83,79,0.04)'); g.addColorStop(1,'rgba(255,183,77,0.02)'); ctx.fillStyle = g; ctx.fillRect(0,0,w,h); }
    function step(){
      ctx.clearRect(0,0,w,h);
      grad();
      for(const p of parts){
        p.x += p.vx; p.y += p.vy;
        if(p.x < -10) p.x = w + 10;
        if(p.x > w + 10) p.x = -10;
        if(p.y < -10) p.y = h + 10;
        if(p.y > h + 10) p.y = -10;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue},80%,60%,${p.alpha})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(step);
    }
    addEventListener('resize', resize);
    resize();
    step();
  }

  // -------------------------
  // Storage helpers
  // -------------------------
  const Storage = {
    get: function(k){
      try { return JSON.parse(localStorage.getItem(k) || '[]'); }
      catch(e){ return []; }
    },
    set: function(k,v){
      try { localStorage.setItem(k, JSON.stringify(v)); }
      catch(e){}
    },
    getOne: function(k){
      try { return JSON.parse(localStorage.getItem(k) || 'null'); }
      catch(e){ return null; }
    },
    setOne: function(k,v){
      try { localStorage.setItem(k, JSON.stringify(v)); }
      catch(e){}
    },
    remove: function(k){ try { localStorage.removeItem(k); } catch(e){} }
  };

  // -------------------------
  // Utilities
  // -------------------------
  function uid(prefix='id'){ return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8); }
  function escapeCsv(s){ if(s == null) return ''; return '"' + String(s).replace(/"/g,'""') + '"'; }
  function maskContact(s){ if(!s) return ''; const t = String(s); return t.length > 4 ? '•••' + t.slice(-4) : t; }

  // expose quick sample for index.html
  window.quickSample = function(){
    const sample = {
      id: uid('rq'),
      from: 'Central Square',
      to: 'City Mall',
      name: 'Demo Rider',
      contact: '99990011',
      idinfo: 'PAN-XYZ',
      fare: 45,
      status: 'Pending',
      created: Date.now()
    };
    const arr = Storage.get('r_rider_requests');
    arr.unshift(sample);
    Storage.set('r_rider_requests', arr);
    alert('Sample rider request added. Open Rider/Driver page to view it.');
  };

  // -------------------------
  // Shared mutate helpers (exposed to page scripts)
  // -------------------------
  window.addRiderRequest = function(obj){
    const arr = Storage.get('r_rider_requests'); arr.unshift(obj); Storage.set('r_rider_requests', arr);
    // also ensure r_history exists
    Storage.get('r_history');
  };
  window.removeRiderRequest = function(id){
    let arr = Storage.get('r_rider_requests'); arr = arr.filter(x => x.id !== id); Storage.set('r_rider_requests', arr);
  };
  window.addDriverPost = function(obj){
    const arr = Storage.get('r_driver_posts'); arr.unshift(obj); Storage.set('r_driver_posts', arr);
  };
  window.removeDriverPost = function(id){
    let arr = Storage.get('r_driver_posts'); arr = arr.filter(x => x.id !== id); Storage.set('r_driver_posts', arr);
  };
  window.moveToHistory = function(entry){
    const h = Storage.get('r_history'); h.unshift(entry); Storage.set('r_history', h);
  };

  // -------------------------
  // Sync: storage event notifier
  // -------------------------
  window.addEventListener('storage', (evt) => {
    if(!evt.key) return;
    // If pages implement window.onSharedDataChange, call it
    if(window.onSharedDataChange) window.onSharedDataChange(evt.key);
  });

  // -------------------------
  // Page-specific wiring
  // -------------------------
  document.addEventListener('DOMContentLoaded', () => {
    const page = location.pathname.split('/').pop();

    // common helper exposed
    window.estimateFare = function(a,b){
      const d = Math.max(1, Math.abs(a.length - b.length) + Math.round((a.split(' ').length + b.split(' ').length) / 2));
      return 30 + (d * 10);
    };

    // RIDER PAGE
    if(page === 'rider.html'){
      const form = document.getElementById('riderForm');
      const listEl = document.getElementById('requestsList');
      const postsEl = document.getElementById('driverPosts');
      const histEl = document.getElementById('riderHistory');

      function render(){
        // rider requests
        const reqs = Storage.get('r_rider_requests');
        listEl.innerHTML = '';
        if(reqs.length === 0) listEl.innerHTML = '<div class="muted">No active rider requests</div>';
        reqs.forEach(rq => {
          const d = document.createElement('div'); d.className = 'ride-card';
          d.innerHTML = `
            <div class='ride-left'>${(rq.name||'R').slice(0,2).toUpperCase()}</div>
            <div style='flex:1'>
              <div style='display:flex;justify-content:space-between'><div><strong>${rq.from}</strong> → <strong>${rq.to}</strong></div><div class='muted'>₹${rq.fare||'—'}</div></div>
              <div class='muted'>${rq.name} • ${maskContact(rq.contact)}</div>
            </div>
            <div class='action-icons'>
              <button class='icon-btn' onclick="reviewRiderReq('${rq.id}')">Review</button>
              <button class='icon-btn danger' onclick="closeRiderReq('${rq.id}')">✖</button>
            </div>`;
          listEl.appendChild(d);
        });

        // driver posts (available rides)
        const posts = Storage.get('r_driver_posts');
        postsEl.innerHTML = '';
        if(posts.length === 0) postsEl.innerHTML = '<div class="muted">No empty rides posted</div>';
        posts.forEach(p => {
          const d = document.createElement('div'); d.className = 'ride-card';
          d.innerHTML = `
            <div style='flex:1'><strong>${p.from}</strong> → <strong>${p.to}</strong><div class='muted'>Driver: ${p.driverName}</div></div>
            <div class='action-icons'>
              <button class='icon-btn' onclick="reviewDriverPost('${p.id}')">Review</button>
              <button class='icon-btn danger' onclick="closeDriverPost('${p.id}')">✖</button>
            </div>`;
          postsEl.appendChild(d);
        });

        // history
        const hist = Storage.get('r_history');
        histEl.innerHTML = '';
        if(hist.length === 0) histEl.innerHTML = '<div class="muted">No completed rides</div>';
        hist.forEach(h => {
          const e = document.createElement('div'); e.className = 'ride-card';
          e.innerHTML = `<div style='flex:1'><strong>${h.from}</strong> → <strong>${h.to}</strong><div class='muted'>${new Date(h.completedAt).toLocaleString()}</div></div><div class='muted'>Rating: ${h.rating||'—'}</div>`;
          histEl.appendChild(e);
        });
      }

      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const from = document.getElementById('r_from').value.trim();
        const to = document.getElementById('r_to').value.trim();
        const name = document.getElementById('r_name').value.trim();
        const contact = document.getElementById('r_contact').value.trim();
        const idinfo = document.getElementById('r_id').value.trim();
        if(!from || !to || !name || !contact || !idinfo){ alert('Complete all fields'); return; }
        const fare = estimateFare(from, to);
        const obj = { id: uid('rq'), from, to, name, contact, idinfo, fare, status: 'Pending', created: Date.now() };
        addRiderRequest(obj);
        form.reset();
        render();
      });

      window.reviewRiderReq = function(id){
        const arr = Storage.get('r_rider_requests'); const r = arr.find(x=>x.id===id);
        if(!r) return alert('Not found');
        alert(`Rider: ${r.name}\nContact: ${r.contact}\nID: ${r.idinfo}\nRoute: ${r.from} → ${r.to}\nFare: ₹${r.fare}`);
      };

      window.closeRiderReq = function(id){
        if(!confirm('Close this request?')) return;
        removeRiderRequest(id);
        render();
      };

      window.reviewDriverPost = function(id){
        const arr = Storage.get('r_driver_posts'); const p = arr.find(x=>x.id===id);
        if(!p) return alert('Not found');
        alert(`Driver: ${p.driverName}\nVehicle: ${p.driverVehicle||'-'}\nRoute: ${p.from} → ${p.to}`);
      };

      window.closeDriverPost = function(id){
        if(!confirm('Remove this driver post?')) return;
        removeDriverPost(id);
        render();
      };

      // react to external changes via storage events
      window.onSharedDataChange = function(key){
        if(['r_rider_requests','r_driver_posts','r_history'].includes(key)) render();
      };

      render();
    } // end rider

    // DRIVER PAGE
    if(page === 'driver.html'){
      const signupBtn = document.getElementById('signupBtn');
      const logoutBtn = document.getElementById('logoutBtn');
      const togglePublish = document.getElementById('togglePublish');
      const publishForm = document.getElementById('publishForm');
      const doPublish = document.getElementById('doPublish');
      const requestsList = document.getElementById('driverRequests');
      const publishedList = document.getElementById('publishedList');
      const driverHistory = document.getElementById('driverHistory');

      function loadProfile(){ return Storage.getOne('r_profile'); }
      function saveProfile(p){ Storage.setOne('r_profile', p); }

      function render(){
        // rider requests
        const reqs = Storage.get('r_rider_requests');
        requestsList.innerHTML = '';
        if(reqs.length === 0) requestsList.innerHTML = '<div class="muted">No rider requests</div>';
        reqs.forEach(rq => {
          const d = document.createElement('div'); d.className = 'ride-card';
          d.innerHTML = `
            <div style='flex:1'><strong>${rq.from}</strong> → <strong>${rq.to}</strong><div class='muted'>${rq.name} • ${maskContact(rq.contact)}</div></div>
            <div class='action-icons'>
              <button class='icon-btn' onclick="reviewRider('${rq.id}')">Review</button>
              <button class='icon-btn' onclick="acceptRider('${rq.id}')">Accept</button>
              <button class='icon-btn danger' onclick="closeRiderReqDriver('${rq.id}')">✖</button>
            </div>`;
          requestsList.appendChild(d);
        });

        // published posts
        const posts = Storage.get('r_driver_posts');
        publishedList.innerHTML = '';
        const me = loadProfile();
        if(!me){ publishedList.innerHTML = '<div class="muted">Sign up to publish</div>'; }
        else {
          const mine = posts.filter(x => x.driverId === me.id);
          if(mine.length === 0) publishedList.innerHTML = '<div class="muted">No published rides</div>';
          mine.forEach(p => {
            const d = document.createElement('div'); d.className = 'ride-card';
            d.innerHTML = `<div style='flex:1'><strong>${p.from}</strong> → <strong>${p.to}</strong><div class='muted'>Published</div></div><div class='action-icons'><button class='icon-btn' onclick="removePublished('${p.id}')">Remove</button></div>`;
            publishedList.appendChild(d);
          });
        }

        // history
        const hist = Storage.get('r_history');
        driverHistory.innerHTML = '';
        if(hist.length === 0) driverHistory.innerHTML = '<div class="muted">No completed rides</div>';
        hist.forEach(h => {
          const e = document.createElement('div'); e.className = 'ride-card';
          e.innerHTML = `<div style='flex:1'><strong>${h.from}</strong> → <strong>${h.to}</strong><div class='muted'>${new Date(h.completedAt).toLocaleString()}</div></div><div class='muted'>Rating: ${h.rating||'—'}</div>`;
          driverHistory.appendChild(e);
        });
      }

      signupBtn.addEventListener('click', () => {
        const ex = loadProfile();
        let name = prompt('Full name:', ex ? ex.name : '');
        if(!name) return;
        let contact = prompt('Contact (phone/email):', ex ? ex.contact : '');
        if(!contact) return;
        let licence = prompt('Licence no:', ex ? ex.licence : '');
        if(!licence) return;
        const prof = ex || { id: uid('drv') };
        prof.name = name; prof.contact = contact; prof.licence = licence;
        saveProfile(prof);
        alert('Driver saved');
        render();
      });

      logoutBtn.addEventListener('click', () => {
        if(!confirm('Logout?')) return;
        Storage.remove('r_profile');
        render();
      });

      togglePublish.addEventListener('click', () => {
        publishForm.classList.toggle('hidden');
      });

      doPublish.addEventListener('click', () => {
        const me = loadProfile();
        if(!me){ alert('Sign up first'); return; }
        const from = document.getElementById('p_from').value.trim();
        const to = document.getElementById('p_to').value.trim();
        if(!from || !to){ alert('Enter from & to'); return; }
        const post = { id: uid('dp'), driverId: me.id, driverName: me.name, driverVehicle: me.licence || '', from, to, created: Date.now() };
        addDriverPost(post);
        document.getElementById('p_from').value = ''; document.getElementById('p_to').value = '';
        render();
        alert('Published');
      });

      window.reviewRider = function(id){
        const arr = Storage.get('r_rider_requests'); const r = arr.find(x=>x.id===id);
        if(!r) return alert('Not found');
        alert(`Rider: ${r.name}\nContact: ${r.contact}\nID: ${r.idinfo}\nRoute: ${r.from} → ${r.to}\nFare: ₹${r.fare}`);
      };

      window.acceptRider = function(id){
        const me = loadProfile();
        if(!me){ alert('Sign up first'); return; }
        let arr = Storage.get('r_rider_requests'); const ix = arr.findIndex(x=>x.id===id);
        if(ix < 0) return;
        if(!confirm('Accept & complete now? OK completes now, Cancel accepts only.')) {
          arr[ix].status = 'Accepted'; arr[ix].matchedDriverId = me.id; Storage.set('r_rider_requests', arr); render();
          alert('Accepted — mark complete later');
          return;
        }
        // complete now
        const rating = prompt('Rate rider 1-5:','5');
        const rq = arr[ix];
        rq.status = 'Completed'; rq.completedAt = Date.now(); rq.rating = rating || '';
        moveToHistory({ id: rq.id, from: rq.from, to: rq.to, completedAt: rq.completedAt, rating: rq.rating });
        arr.splice(ix,1);
        Storage.set('r_rider_requests', arr);
        render();
        alert('Completed & saved');
      };

      window.closeRiderReqDriver = function(id){
        if(!confirm('Remove request?')) return;
        removeRiderRequest(id);
        render();
      };

      window.removePublished = function(id){
        if(!confirm('Remove published ride?')) return;
        removeDriverPost(id);
        render();
      };

      // exports & history controls
      const exportCsvEl = document.getElementById('exportCsv');
      const exportPdfEl = document.getElementById('exportPdf');
      const clearHistoryEl = document.getElementById('clearHistory');
      if(exportCsvEl) exportCsvEl.addEventListener('click', () => {
        const h = Storage.get('r_history'); if(h.length === 0) return alert('No history');
        const hdr = 'from,to,completedAt,rating\n';
        const rows = h.map(x => `${escapeCsv(x.from)},${escapeCsv(x.to)},${new Date(x.completedAt).toISOString()},${x.rating||''}`).join('\n');
        const blob = new Blob([hdr + rows], { type:'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'rshare_history.csv'; a.click(); URL.revokeObjectURL(url);
      });
      if(exportPdfEl) exportPdfEl.addEventListener('click', () => {
        const h = Storage.get('r_history'); if(h.length === 0) return alert('No history');
        const w = window.open('', '_blank');
        let html = `<h2>RShare History</h2><table border=1 style='width:100%;border-collapse:collapse'><tr><th>From</th><th>To</th><th>Date</th><th>Rating</th></tr>`;
        h.forEach(x => html += `<tr><td>${x.from}</td><td>${x.to}</td><td>${new Date(x.completedAt).toLocaleString()}</td><td>${x.rating||''}</td></tr>`);
        html += '</table>';
        w.document.write(html); w.document.close(); w.focus();
      });
      if(clearHistoryEl) clearHistoryEl.addEventListener('click', () => {
        if(!confirm('Clear completed history?')) return;
        Storage.set('r_history', []);
        render();
      });

      // respond to storage changes
      window.onSharedDataChange = function(key){ if(['r_rider_requests','r_driver_posts','r_history'].includes(key)) render(); };

      render();
    } // end driver
  }); // DOMContentLoaded

})(); // IIFE
