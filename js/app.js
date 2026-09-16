import {
  auth, db, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
  doc, getDoc, setDoc, updateDoc, collection, getDocs,
  addDoc, deleteDoc, serverTimestamp, runTransaction, query, where, arrayUnion
} from './core/firebase.js';
import { state } from './core/state.js';
import { esc, fmtDate, initials, statusTone } from './core/utils.js';
import { imageFileToDataUrl } from './services/media.js';

const root = document.getElementById('app');
const isAdmin = () => ['superadmin','admin'].includes(state.profile?.role);
const isStaff = () => ['superadmin','admin','director','coordinator','coach','delegate','physio','fitness','psychologist','scout'].includes(state.profile?.role);
const canManageChallenges = () => ['superadmin','admin','coach'].includes(state.profile?.role);

function showError(message){ root.innerHTML = `<div class="fatal"><h1>EIXA Hub</h1><div class="error">${esc(message)}</div></div>`; }

function authScreen(mode='login', message='', kind='notice') {
  const register = mode === 'register';
  root.innerHTML = `<div class="login"><div class="login-card">
    <div class="brand"><img src="assets/logo-ae-eixample.png" alt="AE Eixample"><div><h1>EIXA Hub</h1><p>AE Eixample · plataforma digital</p></div></div>
    ${message ? `<div class="${kind}">${esc(message)}</div>` : ''}
    ${register ? `<div class="field"><label>Nom i cognoms</label><input id="displayName" autocomplete="name" placeholder="Nom de la família"></div>` : ''}
    <div class="field"><label>Correu electrònic</label><input id="email" type="email" autocomplete="email" placeholder="nom@correu.com"></div>
    <div class="field"><label>Contrasenya</label><input id="password" type="password" autocomplete="${register?'new-password':'current-password'}" placeholder="Mínim 6 caràcters"></div>
    ${register ? `<div class="field"><label>Repetir contrasenya</label><input id="password2" type="password" autocomplete="new-password"></div>` : ''}
    <div class="stack">
      <button id="mainAuthBtn" class="btn primary">${register ? 'Crear compte' : 'Entrar'}</button>
      <button id="toggleAuthBtn" class="btn ghost">${register ? 'Ja tinc compte' : 'Crear un compte'}</button>
      ${register ? '' : '<button id="resetBtn" class="btn ghost">He oblidat la contrasenya</button>'}
    </div>
  </div></div>`;
  document.getElementById('mainAuthBtn').onclick = register ? doRegister : doLogin;
  document.getElementById('toggleAuthBtn').onclick = () => authScreen(register ? 'login' : 'register');
  if (!register) document.getElementById('resetBtn').onclick = doReset;
}

async function doLogin(){
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) return authScreen('login','Escriu el correu i la contrasenya.','error');
  try { await signInWithEmailAndPassword(auth,email,password); }
  catch(e){ authScreen('login','No s’ha pogut iniciar sessió. Revisa les dades.','error'); }
}

async function doRegister(){
  const displayName = document.getElementById('displayName').value.trim();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const p1 = document.getElementById('password').value;
  const p2 = document.getElementById('password2').value;
  if (!displayName || !email || !p1) return authScreen('register','Omple tots els camps.','error');
  if (p1.length < 6) return authScreen('register','La contrasenya ha de tenir com a mínim 6 caràcters.','error');
  if (p1 !== p2) return authScreen('register','Les contrasenyes no coincideixen.','error');
  try {
    const cred = await createUserWithEmailAndPassword(auth,email,p1);
    const familyQuery = query(collection(db,'invitations'),where('email','==',email),where('status','==','pending'));
    const familySnap = await getDocs(familyQuery);
    const familyInvites = familySnap.docs.map(d=>({id:d.id,...d.data()}));
    const staffRef = doc(db,'staffInvitations',email);
    const staffSnap = await getDoc(staffRef);
    const staffInvite = staffSnap.exists() && staffSnap.data().status === 'pending' ? {id:staffSnap.id,...staffSnap.data()} : null;
    const playerIds = [...new Set(familyInvites.map(i=>i.playerId).filter(Boolean))];
    const teamIds = [...new Set(familyInvites.map(i=>i.teamId).filter(Boolean))];
    const role = staffInvite?.role || 'family';
    await setDoc(doc(db,'users',cred.user.uid),{
      email, displayName, role, active:true, clubId:'ae-eixample',
      playerId:playerIds[0]||null, playerIds,
      teamId:teamIds[0]||staffInvite?.teamId||null, teamIds,
      createdAt:serverTimestamp()
    });
    for(const invitation of familyInvites){
      await updateDoc(doc(db,'players',invitation.playerId),{
        guardianUids:arrayUnion(cred.user.uid), guardianEmails:arrayUnion(email), updatedAt:serverTimestamp()
      });
      await updateDoc(doc(db,'invitations',invitation.id),{
        status:'accepted', acceptedUid:cred.user.uid, acceptedAt:serverTimestamp()
      });
    }
    if(staffInvite) await updateDoc(staffRef,{status:'accepted',acceptedUid:cred.user.uid,acceptedAt:serverTimestamp()});
  } catch(e) {
    console.error(e);
    const msg = e.code === 'auth/email-already-in-use' ? 'Aquest correu ja té un compte.' : 'No s’ha pogut crear el compte.';
    authScreen('register',msg,'error');
  }
}
async function doReset(){
  const email = document.getElementById('email').value.trim();
  if (!email) return authScreen('login','Escriu primer el correu.','error');
  try { await sendPasswordResetEmail(auth,email); authScreen('login','T’hem enviat un correu de recuperació.','success'); }
  catch(e){ authScreen('login','No s’ha pogut enviar el correu.','error'); }
}

async function loadProfile(uid){ const s=await getDoc(doc(db,'users',uid)); return s.exists()?{id:s.id,...s.data()}:null; }
async function getPlayer(id){ if(!id) return null; const s=await getDoc(doc(db,'players',id)); return s.exists()?{id:s.id,...s.data()}:null; }

function navBtn(id,label){ return `<button data-view="${id}" class="${state.currentView===id?'active':''}">${label}</button>`; }
function shell(){
  const familyNav = `${navBtn('dashboard','🏠 Inici')}${navBtn('profile','👤 Perfil jugador')}${navBtn('challenges','🏆 Repte d’estiu')}`;
  const staffNav = `${navBtn('dashboard','🏠 Inici')}${navBtn('challenges','🏆 Repte d’estiu')}`;
  const adminNav = `${navBtn('dashboard','🏠 Inici')}${navBtn('teams','👥 Equips')}${navBtn('players','⚽ Jugadors')}${navBtn('users','🔐 Accessos')}${navBtn('challenges','🏆 Repte d’estiu')}${navBtn('scout','📊 Scout Live')}`;
  const activeNav = isAdmin() ? adminNav : (isStaff() ? staffNav : familyNav);
  root.innerHTML = `<div class="app"><aside class="sidebar">
    <div class="brand"><img src="assets/logo-ae-eixample.png" alt="AE Eixample"><div><h1>EIXA Hub</h1><p>AE Eixample</p></div></div>
    <nav class="nav">${activeNav}</nav>
    <div class="sidebar-footer"><div>${esc(state.profile?.displayName||state.currentUser.email)}</div><span class="badge">${esc(state.profile?.role||'usuari')}</span><button id="logoutBtn" class="btn ghost" style="margin-top:10px;width:100%">Tancar sessió</button></div>
  </aside><main class="main"><div id="view"></div></main></div>`;
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.currentView=b.dataset.view;shell();renderView();});
  document.getElementById('logoutBtn').onclick=()=>signOut(auth);
}

async function renderView(){
  const v=document.getElementById('view');
  if(!state.profile) return showError('No s’ha pogut carregar el perfil.');
  if(!isStaff() && !state.profile.playerId) return renderPlayerClaim(v);
  if(state.currentView==='dashboard') return renderDashboard(v);
  if(state.currentView==='profile' && !isStaff()) return renderPlayerProfile(v, state.profile.playerId);
  if(state.currentView==='teams' && isAdmin()) return renderTeams(v);
  if(state.currentView==='players' && isAdmin()) return renderPlayers(v);
  if(state.currentView==='users' && isAdmin()) return renderUsers(v);
  if(state.currentView==='playerAccess' && isAdmin()) return renderPlayerAccess(v,state.selectedPlayerId);
  if(state.currentView==='challenges') return renderChallenges(v);
  if(state.currentView==='scout' && isAdmin()) return placeholder(v,'Scout Live','Mòdul preparat per minuts, xuts, recuperacions, pèrdues, faltes i porter.');
  return renderDashboard(v);
}

async function renderPlayerClaim(v){
  const snap=await getDocs(collection(db,'players'));
  const available=snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.active!==false && !p.guardianUid);
  v.innerHTML=`<div class="topbar"><div><h2>Associa el teu jugador</h2><p class="muted">Cada compte familiar només pot quedar vinculat a un jugador.</p></div></div>
  <div class="card"><div class="field"><label>Jugador/a</label><select id="claimPlayer"><option value="">Selecciona un jugador</option>${available.map(p=>`<option value="${p.id}">${esc(p.name)}${p.number?' · #'+p.number:''}</option>`).join('')}</select></div>
  <button id="claimBtn" class="btn primary">Associar jugador</button><div id="claimMsg"></div></div>`;
  document.getElementById('claimBtn').onclick=async()=>{
    const playerId=document.getElementById('claimPlayer').value;
    if(!playerId) return document.getElementById('claimMsg').innerHTML='<div class="error">Selecciona un jugador.</div>';
    try{
      await runTransaction(db,async tx=>{
        const pRef=doc(db,'players',playerId),uRef=doc(db,'users',state.currentUser.uid);
        const pSnap=await tx.get(pRef);
        if(!pSnap.exists()) throw new Error('Jugador inexistent');
        const p=pSnap.data(); if(p.guardianUid) throw new Error('Ja associat');
        tx.update(pRef,{guardianUid:state.currentUser.uid,guardianEmail:state.currentUser.email,updatedAt:serverTimestamp()});
        tx.update(uRef,{playerId,teamId:p.teamId||null,updatedAt:serverTimestamp()});
      });
      state.profile=await loadProfile(state.currentUser.uid); state.currentView='dashboard'; shell(); renderView();
    }catch(e){document.getElementById('claimMsg').innerHTML='<div class="error">Aquest jugador ja està associat o no es pot assignar.</div>';}
  };
}

async function renderDashboard(v){
  if(isStaff() && !isAdmin()){
    v.innerHTML=`<div class="topbar"><div><h2>Espai tècnic</h2><p class="muted">Benvingut/da, ${esc(state.profile?.displayName||'membre de l’equip')}.</p></div></div><div class="card"><h3>Repte d’estiu</h3><p class="muted">Gestiona i consulta les proves des del mòdul de reptes.</p><button id="staffChallengeBtn" class="btn primary">Obrir reptes</button></div>`;
    document.getElementById('staffChallengeBtn').onclick=()=>{state.currentView='challenges';shell();renderView();};
    return;
  }
  if(isAdmin()){
    const [teamsSnap,playersSnap,usersSnap,invitationsSnap]=await Promise.all([
      getDocs(collection(db,'teams')),
      getDocs(collection(db,'players')),
      getDocs(collection(db,'users')),
      getDocs(collection(db,'invitations')).catch(()=>({docs:[],size:0}))
    ]);
    const teams=teamsSnap.docs.map(d=>({id:d.id,...d.data()}));
    const players=playersSnap.docs.map(d=>({id:d.id,...d.data()}));
    const users=usersSnap.docs.map(d=>({id:d.id,...d.data()}));
    const invitations=(invitationsSnap.docs||[]).map(d=>({id:d.id,...d.data()}));
    const pendingInvites=invitations.filter(x=>(x.status||'pending')==='pending').length;
    const playersWithoutPhoto=players.filter(x=>!(x.photoData||x.photoUrl)).length;
    const playersWithoutObjective=players.filter(x=>!x.currentObjective).length;
    const activePlayers=players.filter(x=>x.active!==false).length;
    const activeTeams=teams.filter(x=>x.active!==false).length;
    const profileCompletion=players.length?Math.round(players.reduce((sum,x)=>{
      const checks=[x.name,x.teamId,x.position,x.number,x.birthYear,(x.photoData||x.photoUrl),x.currentObjective];
      return sum+checks.filter(Boolean).length/7;
    },0)/players.length*100):0;
    const firstPlayer=players[0]||null;
    const firstTeam=teams[0]||null;
    const today=new Intl.DateTimeFormat('ca-ES',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
    const greetingHour=new Date().getHours();
    const greeting=greetingHour<13?'Bon dia':greetingHour<20?'Bona tarda':'Bona nit';
    const alerts=[
      pendingInvites?{tone:'amber',title:`${pendingInvites} invitació${pendingInvites===1?'':'ns'} pendent${pendingInvites===1?'':'s'}`,text:'Revisa els accessos familiars.'}:null,
      playersWithoutObjective?{tone:'amber',title:`${playersWithoutObjective} jugador${playersWithoutObjective===1?'':'s'} sense objectiu`,text:'Completa el seu PDI inicial.'}:null,
      playersWithoutPhoto?{tone:'neutral',title:`${playersWithoutPhoto} perfil${playersWithoutPhoto===1?'':'s'} sense fotografia`,text:'Millora la identificació visual.'}:null
    ].filter(Boolean);

    v.innerHTML=`
    <section class="dashboard-hero">
      <div>
        <span class="dashboard-date">${esc(today)}</span>
        <h1>${greeting}, ${esc(state.profile.displayName||'Dani')}</h1>
        <p>Visió general del club i accions prioritàries.</p>
      </div>
      <div class="dashboard-hero-actions">
        <button class="btn ghost" id="quickNewTeam">Nou equip</button>
        <button class="btn primary" id="quickNewPlayer">Nou jugador</button>
      </div>
    </section>

    <section class="premium-kpi-grid">
      <article class="premium-kpi-card">
        <div class="kpi-icon">EQ</div><div><span>Equips actius</span><strong>${activeTeams}</strong><small>${teams.length} en total</small></div>
      </article>
      <article class="premium-kpi-card">
        <div class="kpi-icon">JG</div><div><span>Jugadors actius</span><strong>${activePlayers}</strong><small>${players.length} perfils registrats</small></div>
      </article>
      <article class="premium-kpi-card">
        <div class="kpi-icon">AC</div><div><span>Accessos</span><strong>${users.length}</strong><small>${pendingInvites} invitacions pendents</small></div>
      </article>
      <article class="premium-kpi-card featured">
        <div class="kpi-icon">26</div><div><span>Temporada</span><strong>2026–27</strong><small>En curs</small></div>
      </article>
    </section>

    <section class="dashboard-columns">
      <div class="dashboard-primary-column">
        <article class="card dashboard-panel">
          <div class="panel-heading"><div><span class="eyebrow">Salut del sistema</span><h3>Preparació dels perfils</h3></div><strong>${profileCompletion}%</strong></div>
          <div class="progress-track"><div class="progress-value" style="width:${profileCompletion}%"></div></div>
          <div class="profile-readiness-grid">
            <div><strong>${players.length-playersWithoutPhoto}</strong><span>amb fotografia</span></div>
            <div><strong>${players.length-playersWithoutObjective}</strong><span>amb objectiu</span></div>
            <div><strong>${activePlayers}</strong><span>actius</span></div>
          </div>
        </article>

        <article class="card dashboard-panel">
          <div class="panel-heading"><div><span class="eyebrow">Accions ràpides</span><h3>Continua construint el club</h3></div></div>
          <div class="quick-command-grid">
            <button data-dashboard-action="players"><b>Afegir jugador</b><span>Crear i assignar un nou perfil</span></button>
            <button data-dashboard-action="teams"><b>Gestionar equips</b><span>Plantilles, categories i temporada</span></button>
            <button data-dashboard-action="users"><b>Convidar família</b><span>Vincular accessos a un jugador</span></button>
            <button data-dashboard-action="challenges"><b>Repte d’estiu</b><span>Configurar la primera experiència</span></button>
          </div>
        </article>

        <article class="card dashboard-panel">
          <div class="panel-heading"><div><span class="eyebrow">Activitat recent</span><h3>Últims moviments</h3></div></div>
          <div class="activity-feed">
            ${firstPlayer?`<div class="activity-item"><span class="activity-mark red"></span><div><strong>${esc(firstPlayer.name)}</strong><p>Perfil de jugador disponible a ${esc((teams.find(t=>t.id===firstPlayer.teamId)||{}).name||'sense equip')}.</p></div><small>Jugador</small></div>`:''}
            ${firstTeam?`<div class="activity-item"><span class="activity-mark gold"></span><div><strong>${esc(firstTeam.name)}</strong><p>Equip actiu a la temporada 2026–27.</p></div><small>Equip</small></div>`:''}
            <div class="activity-item"><span class="activity-mark green"></span><div><strong>EIXA Hub · PW-002.1</strong><p>Dashboard premium i sistema visual actualitzats.</p></div><small>Plataforma</small></div>
          </div>
        </article>
      </div>

      <aside class="dashboard-secondary-column">
        <article class="card dashboard-panel alert-panel">
          <div class="panel-heading"><div><span class="eyebrow">Prioritats</span><h3>Alertes del club</h3></div><span class="badge">${alerts.length}</span></div>
          <div class="alert-list">
            ${alerts.length?alerts.map(a=>`<div class="dashboard-alert ${a.tone}"><span></span><div><strong>${esc(a.title)}</strong><p>${esc(a.text)}</p></div></div>`).join(''):`<div class="dashboard-empty-state"><strong>Tot al dia</strong><p>No hi ha cap alerta prioritària.</p></div>`}
          </div>
        </article>

        <article class="card dashboard-panel season-panel">
          <span class="eyebrow">Proper focus</span>
          <h3>Activar el Repte d’estiu</h3>
          <p>La base de jugadors i accessos ja està preparada. El següent pas és llançar la primera experiència familiar.</p>
          <button class="btn primary" id="dashboardChallenge">Obrir reptes</button>
        </article>

        <article class="card dashboard-panel system-panel">
          <div class="system-status"><span></span><div><strong>Firebase connectat</strong><small>Dades sincronitzades</small></div></div>
          <div class="system-status"><span></span><div><strong>Netlify operatiu</strong><small>Desplegament automàtic</small></div></div>
          <div class="system-status"><span></span><div><strong>Milestone PW-002.1</strong><small>Player Workspace</small></div></div>
        </article>
      </aside>
    </section>`;

    const go=view=>{state.currentView=view;shell();renderView();};
    document.getElementById('quickNewPlayer').onclick=()=>go('players');
    document.getElementById('quickNewTeam').onclick=()=>go('teams');
    document.getElementById('dashboardChallenge').onclick=()=>go('challenges');
    document.querySelectorAll('[data-dashboard-action]').forEach(btn=>btn.onclick=()=>go(btn.dataset.dashboardAction));
  } else {
    const p=await getPlayer(state.profile.playerId);
    const teamSnap=p?.teamId?await getDoc(doc(db,'teams',p.teamId)):null;
    const team=teamSnap?.exists()?teamSnap.data():null;
    const greetingHour=new Date().getHours();
    const greeting=greetingHour<13?'Bon dia':greetingHour<20?'Bona tarda':'Bona nit';
    v.innerHTML=`<section class="dashboard-hero family-dashboard-hero"><div><span class="dashboard-date">Espai familiar</span><h1>${greeting}, ${esc(state.profile.displayName)}</h1><p>Tot el que necessites sobre ${esc(p?.name||'el teu jugador')}.</p></div></section>
    <section class="family-dashboard-grid">
      <article class="card family-player-card"><div class="avatar-lg">${esc(initials(p?.name||'Jugador'))}</div><div><span class="eyebrow">${esc(team?.name||'Sense equip')}</span><h2>${esc(p?.name||'Jugador')}</h2><p>${p?.number?'Dorsal '+esc(p.number)+' · ':''}${esc(p?.position||'')}</p></div><button class="btn ghost" id="familyProfile">Veure perfil</button></article>
      <article class="card family-action-card"><span class="eyebrow">Repte actiu</span><h3>Repte d’estiu</h3><p>Consulta la proposta, registra l’activitat i segueix la progressió.</p><button class="btn primary" id="goChallenge">Començar</button></article>
    </section>`;
    document.getElementById('goChallenge').onclick=()=>{state.currentView='challenges';shell();renderView();};
    document.getElementById('familyProfile').onclick=()=>{state.currentView='profile';shell();renderView();};
  }
}

async function renderPlayerProfile(v, playerId){
  const targetId = playerId || state.profile.playerId;
  const p = await getPlayer(targetId);
  if(!p) return placeholder(v,'Perfil jugador','No s’ha trobat el jugador associat.');
  const teamSnap = p.teamId ? await getDoc(doc(db,'teams',p.teamId)) : null;
  const team = teamSnap?.exists() ? teamSnap.data() : null;
  const teamName = team?.name || 'Sense equip';
  const category = team?.category || p.category || 'Categoria pendent';
  const canEditProfile = isAdmin();
  const canEditPhoto = isAdmin() || (!isAdmin() && targetId === state.profile.playerId);
  const age = p.birthYear ? Math.max(0,new Date().getFullYear()-Number(p.birthYear)) : null;
  const yearsAtClub = p.joinYear ? Math.max(0,new Date().getFullYear()-Number(p.joinYear)) : null;
  const photo = p.photoData || p.photoUrl || '';
  const guardianCount = Array.isArray(p.guardianUids) ? p.guardianUids.length : (p.guardianUid ? 1 : 0);
  const objectiveProgress = Math.min(100,Math.max(0,Number(p.objectiveProgress)||0));
  const scoreValue = value => Number.isFinite(Number(value)) ? Math.min(100,Math.max(0,Number(value))) : null;
  const kpis = [
    {key:'sport',label:'Esport',icon:'SP',value:scoreValue(p.sportScore),status:p.sportStatus||'Sense dades',help:'Tècnica i tàctica'},
    {key:'body',label:'Cos',icon:'CO',value:scoreValue(p.bodyScore||p.healthScore),status:p.bodyStatus||p.healthStatus||'Sense dades',help:'Disponibilitat i càrrega'},
    {key:'wellbeing',label:'Benestar',icon:'BE',value:scoreValue(p.wellbeingScore),status:p.wellbeingStatus||'Sense dades',help:'Motivació i estat emocional'},
    {key:'commitment',label:'Compromís',icon:'CM',value:scoreValue(p.commitmentScore),status:p.commitmentStatus||'Sense dades',help:'Assistència i participació'}
  ];
  const actions = [];
  if(!photo) actions.push({tone:'warning',title:'Afegir fotografia',text:'Completa la identificació visual del jugador.',action:'photo'});
  if(!p.currentObjective) actions.push({tone:'danger',title:'Definir l’objectiu actual',text:'El PDI encara no té una prioritat activa.',action:'objective'});
  if(!guardianCount && isAdmin()) actions.push({tone:'warning',title:'Vincular una família',text:'Prepara l’accés familiar del jugador.',action:'access'});
  if(!actions.length) actions.push({tone:'success',title:'Perfil al dia',text:'No hi ha cap acció prioritària pendent.',action:null});
  const timeline = Array.isArray(p.timeline) && p.timeline.length ? p.timeline.slice(0,5) : [
    ...(p.currentObjective?[{date:'Actual',title:`Objectiu actiu: ${p.currentObjective}`,type:'objective'}]:[]),
    {date:p.seasonId||'2026-27',title:`Assignació a ${teamName}`,type:'team'},
    {date:'Perfil',title:'Perfil esportiu disponible',type:'profile'}
  ];

  v.innerHTML=`<section class="player-workspace">
    <header class="player-workspace-toolbar">
      <div>${isAdmin()?'<button id="backToPlayers" class="eixa-button eixa-button--ghost">← Jugadors</button>':''}<span class="eyebrow">Player Workspace</span><h2>Resum executiu</h2><p>Qui és, com està i què necessita avui.</p></div>
      <div class="player-workspace-toolbar__actions">${canEditProfile?'<button id="editProfileBtn" class="eixa-button eixa-button--secondary">Editar perfil</button>':''}${isAdmin()?'<button id="profileAccessBtn" class="eixa-button eixa-button--primary">Gestionar accessos</button>':''}</div>
    </header>

    <article class="eixa-card player-hero-component">
      <div class="player-hero-component__photo">
        ${photo?`<img class="eixa-avatar eixa-avatar--xl player-hero-component__image" src="${photo}" alt="Foto de ${esc(p.name)}">`:`<div class="eixa-avatar eixa-avatar--xl">${esc(initials(p.name))}</div>`}
        ${canEditPhoto?'<button id="changePhotoBtn" class="player-hero-component__photo-action">Canviar foto</button><input id="playerPhotoInput" type="file" accept="image/*" hidden>':''}
      </div>
      <div class="player-hero-component__identity">
        <div class="player-hero-component__headline"><div><span class="eyebrow">${esc(category)} · ${esc(p.seasonId||'2026-27')}</span><h1>${esc(p.name)}</h1><p>${esc(teamName)}${p.number?' · #'+esc(p.number):''}${p.position?' · '+esc(p.position):''}</p></div><span class="eixa-badge ${p.active===false?'eixa-badge--danger':'eixa-badge--success'}">${p.active===false?'Inactiu':'Actiu'}</span></div>
        <div class="player-hero-component__meta"><span>${age!==null?age+' anys':'Edat pendent'}</span><span>${yearsAtClub!==null?yearsAtClub+' anys al club':'Antiguitat pendent'}</span><span>${p.dominantFoot?'Peu '+esc(p.dominantFoot.toLowerCase()):'Peu pendent'}</span><span>${guardianCount?guardianCount+' accés familiar':'Sense accés familiar'}</span></div>
        <div id="photoMsg"></div>
      </div>
    </article>

    <section class="player-kpi-grid" aria-label="Indicadors del jugador">
      ${kpis.map(k=>`<article class="eixa-card player-kpi-card ${statusTone(k.status)}"><div class="player-kpi-card__icon">${k.icon}</div><div><span>${k.label}</span><strong>${k.value===null?'—':k.value}</strong><small>${esc(k.status)} · ${k.help}</small></div></article>`).join('')}
    </section>

    <section class="player-summary-grid">
      <article class="eixa-card player-objective-component">
        <div class="eixa-section__header"><div><span class="eyebrow">Prioritat actual</span><h3 class="eixa-section__title">Objectiu individual</h3></div>${canEditProfile?'<button id="quickObjectiveBtn" class="eixa-button eixa-button--ghost">Editar</button>':''}</div>
        <p class="player-objective-component__text">${esc(p.currentObjective||'Encara no hi ha cap objectiu individual definit.')}</p>
        <div class="player-objective-component__progress"><div class="player-objective-component__progress-head"><span>Progrés registrat</span><strong>${objectiveProgress}%</strong></div><div class="eixa-progress"><div class="eixa-progress__value" style="width:${objectiveProgress}%"></div></div></div>
        <div class="player-objective-component__meta"><span>Responsable: ${esc(p.objectiveOwner||'Entrenador principal')}</span><span>Revisió: ${esc(p.objectiveReviewDate||'Pendent')}</span></div>
      </article>

      <article class="eixa-card player-action-panel">
        <div><span class="eyebrow">Què cal fer avui</span><h3 class="eixa-section__title">Accions prioritàries</h3></div>
        <div class="player-action-panel__list">${actions.map((a,i)=>`<button class="player-action-item player-action-item--${a.tone}" ${a.action?`data-player-action="${a.action}"`:'disabled'}><span></span><div><strong>${esc(a.title)}</strong><small>${esc(a.text)}</small></div><b>${a.action?'→':'✓'}</b></button>`).join('')}</div>
      </article>
    </section>

    <section class="player-detail-grid">
      <article class="eixa-card player-timeline-component">
        <div class="eixa-section__header"><div><span class="eyebrow">Últims moviments</span><h3 class="eixa-section__title">Timeline</h3></div><span class="eixa-badge eixa-badge--neutral">${timeline.length} registres</span></div>
        <div class="eixa-timeline">${timeline.map(item=>`<div class="eixa-timeline__item"><div class="eixa-timeline__marker"></div><div><small>${esc(item.date||'')}</small><strong>${esc(item.title||'')}</strong></div></div>`).join('')}</div>
      </article>

      <aside class="player-detail-side">
        <article class="eixa-card"><span class="eyebrow">Dades esportives</span><dl class="detail-list compact"><div><dt>Equip</dt><dd>${esc(teamName)}</dd></div><div><dt>Categoria</dt><dd>${esc(category)}</dd></div><div><dt>Posició</dt><dd>${esc(p.position||'—')}</dd></div><div><dt>Dorsal</dt><dd>${esc(p.number||'—')}</dd></div><div><dt>Alçada</dt><dd>${p.heightCm?esc(p.heightCm)+' cm':'—'}</dd></div><div><dt>Naixement</dt><dd>${esc(p.birthYear||'—')}</dd></div></dl></article>
        <article class="eixa-card"><span class="eyebrow">Accions ràpides</span><div class="player-quick-actions"><button id="openChallengeProfile" class="eixa-button eixa-button--primary">Obrir Repte d’estiu</button>${isAdmin()?'<button id="openAccessProfile" class="eixa-button eixa-button--secondary">Accessos familiars</button>':''}</div></article>
      </aside>
    </section>

    <section class="eixa-card player-pdi-component"><div class="eixa-section__header"><div><span class="eyebrow">Pla de Desenvolupament Individual</span><h3 class="eixa-section__title">PDI compartit</h3></div><span class="eixa-badge eixa-badge--gold">Estructura inicial</span></div><div class="player-pdi-component__grid">${[
      ['Tècnic','technical'],['Tàctic','tactical'],['Físic','physical'],['Emocional','emotional'],['Hàbits','habits'],['Persona','person']
    ].map(([label,key])=>`<div><span>${label}</span><strong>${esc((p.development||{})[key]||'Objectiu pendent')}</strong></div>`).join('')}</div><div class="player-pdi-component__footer"><span>Coordinador: ${esc(p.pdiCoordinator||'Entrenador principal')}</span><span>Propera revisió: ${esc(p.pdiReviewDate||'Pendent')}</span></div></section>
  </section>`;

  if(isAdmin()) document.getElementById('backToPlayers').onclick=()=>{state.currentView='players';state.selectedPlayerId=null;shell();renderView()};
  document.getElementById('openChallengeProfile').onclick=()=>{state.currentView='challenges';shell();renderView()};
  if(isAdmin()){
    document.getElementById('profileAccessBtn').onclick=document.getElementById('openAccessProfile').onclick=()=>{state.selectedPlayerId=targetId;state.currentView='playerAccess';shell();renderView()};
  }
  if(canEditPhoto){
    const photoInput=document.getElementById('playerPhotoInput');
    document.getElementById('changePhotoBtn').onclick=()=>photoInput.click();
    photoInput.onchange=async(e)=>{
      const file=e.target.files?.[0]; if(!file) return;
      const msg=document.getElementById('photoMsg'); msg.innerHTML='<div class="notice">Preparant la foto...</div>';
      try{
        const photoData=await imageFileToDataUrl(file);
        await updateDoc(doc(db,'players',targetId),{photoData,photoUpdatedAt:serverTimestamp(),updatedAt:serverTimestamp()});
        msg.innerHTML='<div class="success">Foto actualitzada.</div>'; setTimeout(()=>renderPlayerProfile(v,targetId),500);
      }catch(err){msg.innerHTML=`<div class="error">${esc(err.message||'No s’ha pogut guardar la foto.')}</div>`}
    };
  }
  const openEditor=()=>{
    const modal=document.createElement('div'); modal.className='modal-backdrop';
    modal.innerHTML=`<div class="modal-card"><div class="section-heading"><h3>Editar perfil esportiu</h3><button id="closeProfileModal" class="icon-btn">×</button></div><div class="form-grid">
      <div class="field"><label>Nom</label><input id="epName" value="${esc(p.name||'')}"></div><div class="field"><label>Dorsal</label><input id="epNumber" type="number" value="${esc(p.number||'')}"></div><div class="field"><label>Posició</label><input id="epPosition" value="${esc(p.position||'')}"></div><div class="field"><label>Any de naixement</label><input id="epBirth" type="number" value="${esc(p.birthYear||'')}"></div><div class="field"><label>Any d’entrada al club</label><input id="epJoin" type="number" value="${esc(p.joinYear||'')}"></div><div class="field"><label>Peu dominant</label><select id="epFoot"><option value="">Sense definir</option><option ${p.dominantFoot==='Dret'?'selected':''}>Dret</option><option ${p.dominantFoot==='Esquerre'?'selected':''}>Esquerre</option><option ${p.dominantFoot==='Ambdós'?'selected':''}>Ambdós</option></select></div><div class="field"><label>Alçada (cm)</label><input id="epHeight" type="number" value="${esc(p.heightCm||'')}"></div><div class="field"><label>Revisió de l’objectiu</label><input id="epReview" type="date" value="${esc(p.objectiveReviewDate||'')}"></div><div class="field"><label>Progrés objectiu (%)</label><input id="epProgress" type="number" min="0" max="100" value="${objectiveProgress}"></div></div><div class="field"><label>Objectiu actual</label><textarea id="epObjective" rows="3">${esc(p.currentObjective||'')}</textarea></div><div class="stack-row"><button id="saveProfile" class="eixa-button eixa-button--primary">Guardar canvis</button><button id="cancelProfile" class="eixa-button eixa-button--ghost">Cancel·lar</button></div><div id="profileMsg"></div></div>`;
    document.body.appendChild(modal);
    const close=()=>modal.remove(); document.getElementById('closeProfileModal').onclick=close;document.getElementById('cancelProfile').onclick=close;modal.onclick=e=>{if(e.target===modal)close()};
    document.getElementById('saveProfile').onclick=async()=>{
      await updateDoc(doc(db,'players',targetId),{name:epName.value.trim(),number:+epNumber.value||null,position:epPosition.value.trim(),birthYear:+epBirth.value||null,joinYear:+epJoin.value||null,dominantFoot:epFoot.value||null,heightCm:+epHeight.value||null,currentObjective:epObjective.value.trim(),objectiveReviewDate:epReview.value||null,objectiveProgress:Math.min(100,Math.max(0,+epProgress.value||0)),updatedAt:serverTimestamp()});
      document.getElementById('profileMsg').innerHTML='<div class="success">Perfil actualitzat.</div>';setTimeout(()=>{close();renderPlayerProfile(v,targetId)},500);
    };
  };
  if(canEditProfile){document.getElementById('editProfileBtn').onclick=openEditor;document.getElementById('quickObjectiveBtn').onclick=openEditor;}
  document.querySelectorAll('[data-player-action]').forEach(button=>button.onclick=()=>{
    const action=button.dataset.playerAction;
    if(action==='photo' && canEditPhoto) document.getElementById('changePhotoBtn').click();
    if(action==='objective' && canEditProfile) openEditor();
    if(action==='access' && isAdmin()){state.selectedPlayerId=targetId;state.currentView='playerAccess';shell();renderView();}
  });
}

async function renderTeams(v){
  v.innerHTML=`<div class="topbar"><h2>Equips</h2></div><div class="card"><h3>Crear equip</h3><div class="form-grid"><div class="field"><label>Nom</label><input id="teamName" placeholder="Aleví A"></div><div class="field"><label>Categoria</label><input id="teamCategory" placeholder="Aleví"></div></div><button id="addTeam" class="btn primary">Afegir equip</button></div><div class="card section"><div id="teamList">Carregant...</div></div>`;
  document.getElementById('addTeam').onclick=async()=>{const name=teamName.value.trim(),category=teamCategory.value.trim();if(!name)return;await addDoc(collection(db,'teams'),{name,category,clubId:'ae-eixample',seasonId:'2026-27',active:true,createdAt:serverTimestamp()});renderTeams(v);};
  const s=await getDocs(collection(db,'teams')),rows=s.docs.map(d=>({id:d.id,...d.data()}));
  teamList.innerHTML=rows.length?`<table class="table"><thead><tr><th>Equip</th><th>Categoria</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.category||'')}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Encara no hi ha equips.</div>';
}

async function renderPlayers(v){
  const ts=await getDocs(collection(db,'teams')); const teams=ts.docs.map(d=>({id:d.id,...d.data()}));
  v.innerHTML=`<div class="topbar"><h2>Jugadors</h2><span class="badge">Administració</span></div><div class="card"><h3>Crear jugador</h3><div class="form-grid"><div class="field"><label>Nom</label><input id="playerName"></div><div class="field"><label>Dorsal</label><input id="playerNumber" type="number"></div><div class="field"><label>Equip</label><select id="playerTeam"><option value="">Selecciona equip</option>${teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Posició</label><input id="playerPosition" placeholder="Ala, pivot, porter..."></div></div><button id="addPlayer" class="btn primary">Afegir jugador</button><div id="playerMsg"></div></div><div class="card section"><h3>Jugadors creats</h3><div id="playerList" class="empty">Carregant...</div></div>`;
  document.getElementById('addPlayer').onclick=async()=>{const name=playerName.value.trim(),teamId=playerTeam.value;if(!name||!teamId)return playerMsg.innerHTML='<div class="error">Nom i equip són obligatoris.</div>';await addDoc(collection(db,'players'),{name,number:+playerNumber.value||null,teamId,position:playerPosition.value.trim(),clubId:'ae-eixample',seasonId:'2026-27',active:true,guardianUid:null,guardianUids:[],guardianEmails:[],createdAt:serverTimestamp()});renderPlayers(v);};
  const s=await getDocs(collection(db,'players')),tn=Object.fromEntries(teams.map(t=>[t.id,t.name])),rows=s.docs.map(d=>({id:d.id,...d.data()}));
  playerList.innerHTML=rows.length?`<table class="table"><thead><tr><th>#</th><th>Jugador</th><th>Equip</th><th>Accessos</th><th></th></tr></thead><tbody>${rows.map(r=>{const n=(r.guardianUids?.length||0)+(r.guardianUid&&!r.guardianUids?.includes(r.guardianUid)?1:0);return `<tr><td>${esc(r.number||'')}</td><td>${esc(r.name)}</td><td>${esc(tn[r.teamId]||'')}</td><td>${n?n+' actiu(s)':'Sense tutor actiu'}</td><td><div class="stack-row"><button class="btn ghost open-profile" data-player="${r.id}">Obrir fitxa</button><button class="btn ghost access-player" data-player="${r.id}">Accessos</button></div></td></tr>`}).join('')}</tbody></table>`:'<div class="empty">Encara no hi ha jugadors.</div>';
  document.querySelectorAll('.open-profile').forEach(b=>b.onclick=()=>{state.selectedPlayerId=b.dataset.player;state.playerProfileTab='summary';state.currentView='profile';shell();renderView();});
  document.querySelectorAll('.access-player').forEach(b=>b.onclick=()=>{state.selectedPlayerId=b.dataset.player;state.currentView='playerAccess';shell();renderView();});
}

async function renderUsers(v){
  const [userSnap, playerSnap, teamSnap, inviteSnap, staffInviteSnap] = await Promise.all([
    getDocs(collection(db,'users')), getDocs(collection(db,'players')), getDocs(collection(db,'teams')),
    getDocs(collection(db,'invitations')), getDocs(collection(db,'staffInvitations'))
  ]);
  const users=userSnap.docs.map(d=>({id:d.id,...d.data()}));
  const players=playerSnap.docs.map(d=>({id:d.id,...d.data()}));
  const teams=teamSnap.docs.map(d=>({id:d.id,...d.data()}));
  const invites=inviteSnap.docs.map(d=>({id:d.id,...d.data()}));
  const staffInvites=staffInviteSnap.docs.map(d=>({id:d.id,...d.data()}));
  const teamName=Object.fromEntries(teams.map(t=>[t.id,t.name]));
  const internalUsers=users.filter(u=>u.role!=='family');
  const familyUsers=users.filter(u=>u.role==='family');
  const familyCountByPlayer={};
  for(const u of familyUsers){for(const pid of (u.playerIds?.length?u.playerIds:[u.playerId]).filter(Boolean)) familyCountByPlayer[pid]=(familyCountByPlayer[pid]||0)+1;}
  const pendingByPlayer={}; invites.filter(i=>i.status==='pending').forEach(i=>pendingByPlayer[i.playerId]=(pendingByPlayer[i.playerId]||0)+1);
  v.innerHTML=`<div class="topbar"><div><h2>Accessos</h2><p class="muted">Gestiona el personal del club i els accessos familiars vinculats als jugadors.</p></div></div>
  <div class="tabs"><button id="tabFamilies" class="tab ${state.accessTab==='families'?'active':''}">👨‍👩‍👧 Famílies</button><button id="tabStaff" class="tab ${state.accessTab==='staff'?'active':''}">👥 Personal del club</button></div>
  <div id="accessContent"></div>`;
  document.getElementById('tabFamilies').onclick=()=>{state.accessTab='families';renderUsers(v)};
  document.getElementById('tabStaff').onclick=()=>{state.accessTab='staff';renderUsers(v)};
  const c=document.getElementById('accessContent');
  if(state.accessTab==='families'){
    c.innerHTML=`<div class="card"><div class="topbar"><div><h3>Famílies per jugador</h3><p class="muted">Entra al jugador per afegir pare, mare, tutor/a o una altra persona autoritzada.</p></div></div>${players.length?`<div class="access-grid">${players.map(p=>`<button class="access-card" data-player="${p.id}"><strong>${esc(p.name)}</strong><span>${esc(teamName[p.teamId]||'Sense equip')}</span><small>${familyCountByPlayer[p.id]||0} actiu(s) · ${pendingByPlayer[p.id]||0} pendent(s)</small></button>`).join('')}</div>`:'<div class="empty">Encara no hi ha jugadors.</div>'}</div>`;
    document.querySelectorAll('.access-card').forEach(b=>b.onclick=()=>{state.selectedPlayerId=b.dataset.player;state.currentView='playerAccess';shell();renderView();});
  }else{
    const roles=[['admin','Administrador'],['director','Director esportiu'],['coordinator','Coordinador'],['coach','Entrenador'],['delegate','Delegat'],['physio','Fisioterapeuta'],['fitness','Preparador físic'],['psychologist','Psicòleg'],['scout','Scout']];
    c.innerHTML=`<div class="card"><div class="topbar"><h3>Personal del club</h3><button id="newStaffBtn" class="btn primary">+ Nou membre</button></div><div id="staffForm" style="display:none"><div class="form-grid"><div class="field"><label>Nom i cognoms</label><input id="staffName"></div><div class="field"><label>Correu electrònic</label><input id="staffEmail" type="email"></div><div class="field"><label>Rol</label><select id="staffRole">${roles.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div><div class="field"><label>Equip (opcional)</label><select id="staffTeam"><option value="">Sense equip concret</option>${teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div></div><div class="stack-row"><button id="saveStaffBtn" class="btn primary">Crear invitació</button><button id="cancelStaffBtn" class="btn ghost">Cancel·lar</button></div><div id="staffMsg"></div></div></div>
    <div class="card section"><h3>Membres actius</h3>${internalUsers.length?`<table class="table"><thead><tr><th>Nom</th><th>Correu</th><th>Rol</th><th>Equip</th></tr></thead><tbody>${internalUsers.map(u=>`<tr><td>${esc(u.displayName||'')}</td><td>${esc(u.email||'')}</td><td>${esc(u.role||'')}</td><td>${esc(teamName[u.teamId]||'—')}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Encara no hi ha personal.</div>'}</div>
    <div class="card section"><h3>Invitacions pendents</h3>${staffInvites.length?`<table class="table"><thead><tr><th>Nom</th><th>Correu</th><th>Rol</th><th>Estat</th></tr></thead><tbody>${staffInvites.map(i=>`<tr><td>${esc(i.displayName||'')}</td><td>${esc(i.email||'')}</td><td>${esc(i.role||'')}</td><td>${i.status==='accepted'?'Acceptada':'Pendent'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">No hi ha invitacions.</div>'}</div>`;
    const form=document.getElementById('staffForm');
    document.getElementById('newStaffBtn').onclick=()=>form.style.display='block';
    document.getElementById('cancelStaffBtn').onclick=()=>form.style.display='none';
    document.getElementById('saveStaffBtn').onclick=async()=>{const displayName=staffName.value.trim(),email=staffEmail.value.trim().toLowerCase(),role=staffRole.value,teamId=staffTeam.value||null;if(!displayName||!email)return staffMsg.innerHTML='<div class="error">Omple nom i correu.</div>';await setDoc(doc(db,'staffInvitations',email),{displayName,email,role,teamId,clubId:'ae-eixample',status:'pending',createdBy:state.currentUser.uid,createdAt:serverTimestamp()});staffMsg.innerHTML='<div class="success">Invitació preparada. Aquesta persona ha de crear el compte amb aquest correu.</div>';setTimeout(()=>renderUsers(v),1200)};
  }
}

async function renderPlayerAccess(v,playerId){
  if(!playerId){state.currentView='players';shell();return renderView();}
  const [pSnap,tSnap,uSnap,iSnap]=await Promise.all([getDoc(doc(db,'players',playerId)),getDocs(collection(db,'teams')),getDocs(collection(db,'users')),getDocs(query(collection(db,'invitations'),where('playerId','==',playerId)))]);
  if(!pSnap.exists()) return placeholder(v,'Jugador','No s’ha trobat el jugador.');
  const player={id:pSnap.id,...pSnap.data()},teams=tSnap.docs.map(d=>({id:d.id,...d.data()})),tn=Object.fromEntries(teams.map(t=>[t.id,t.name]));
  const users=uSnap.docs.map(d=>({id:d.id,...d.data()})).filter(u=>(u.playerIds||[u.playerId]).includes(playerId));
  const invites=iSnap.docs.map(d=>({id:d.id,...d.data()}));
  v.innerHTML=`<div class="topbar"><div><button id="backPlayers" class="btn ghost">← Tornar</button><h2 style="margin-top:12px">${esc(player.name)} · Accessos</h2><p class="muted">${esc(tn[player.teamId]||'Sense equip')}</p></div><button id="newGuardianBtn" class="btn primary">+ Afegir tutor</button></div>
  <div id="guardianForm" class="card" style="display:none"><h3>Nou accés familiar</h3><div class="form-grid"><div class="field"><label>Nom i cognoms</label><input id="guardianName"></div><div class="field"><label>Correu electrònic</label><input id="guardianEmail" type="email"></div><div class="field"><label>Relació</label><select id="guardianRelation"><option value="mother">Mare</option><option value="father">Pare</option><option value="guardian">Tutor/a</option><option value="grandparent">Avi/Àvia</option><option value="other">Altre</option></select></div></div><div class="stack-row"><button id="saveGuardianBtn" class="btn primary">Crear invitació</button><button id="cancelGuardianBtn" class="btn ghost">Cancel·lar</button></div><div id="guardianMsg"></div></div>
  <div class="card section"><h3>Accessos actius</h3>${users.length?`<table class="table"><thead><tr><th>Nom</th><th>Correu</th><th>Relació</th><th>Estat</th></tr></thead><tbody>${users.map(u=>`<tr><td>${esc(u.displayName||'')}</td><td>${esc(u.email||'')}</td><td>${esc(u.relationships?.[playerId]||'Família')}</td><td>Actiu</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Encara no hi ha accessos actius.</div>'}</div>
  <div class="card section"><h3>Invitacions</h3>${invites.length?`<table class="table"><thead><tr><th>Nom</th><th>Correu</th><th>Relació</th><th>Estat</th></tr></thead><tbody>${invites.map(i=>`<tr><td>${esc(i.displayName||'')}</td><td>${esc(i.email||'')}</td><td>${esc(i.relationshipLabel||i.relationship||'Família')}</td><td>${i.status==='accepted'?'Acceptada':'Pendent'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">No hi ha invitacions.</div>'}</div>`;
  document.getElementById('backPlayers').onclick=()=>{state.currentView='users';state.accessTab='families';shell();renderView()};
  const form=document.getElementById('guardianForm');document.getElementById('newGuardianBtn').onclick=()=>form.style.display='block';document.getElementById('cancelGuardianBtn').onclick=()=>form.style.display='none';
  document.getElementById('saveGuardianBtn').onclick=async()=>{const displayName=guardianName.value.trim(),email=guardianEmail.value.trim().toLowerCase(),relationship=guardianRelation.value;const labels={mother:'Mare',father:'Pare',guardian:'Tutor/a',grandparent:'Avi/Àvia',other:'Altre'};if(!displayName||!email)return guardianMsg.innerHTML='<div class="error">Omple nom i correu.</div>';const id=(email+'--'+playerId).replaceAll('/','_');await setDoc(doc(db,'invitations',id),{email,displayName,role:'family',relationship,relationshipLabel:labels[relationship],playerId,teamId:player.teamId||null,clubId:'ae-eixample',status:'pending',createdBy:state.currentUser.uid,createdAt:serverTimestamp()});guardianMsg.innerHTML='<div class="success">Invitació preparada. El tutor ha de crear el compte amb aquest correu.</div>';setTimeout(()=>renderPlayerAccess(v,playerId),1200)};
}
const DEFAULT_TASKS=[
  {id:'train',name:'Entrenament complet',cat:'E',type:'sessions',value:2,max:20},
  {id:'extra',name:'Treball exterior extra',cat:'E',type:'sessions',value:1,max:10},
  {id:'touch50',name:'Repte de 50 tocs',cat:'T',type:'sessions',value:2,max:20},
  {id:'touch100',name:'Repte de 100 tocs',cat:'T',type:'sessions',value:4,max:40},
  {id:'gestures',name:'Arbre de gestos tècnics',cat:'T',type:'rating',value:2,max:10},
  {id:'healthy',name:'Menjar sa',cat:'H',type:'rating',value:1,max:5},
  {id:'sleep',name:'Dormir bé',cat:'H',type:'rating',value:1,max:5},
  {id:'reading',name:'Lectura',cat:'H',type:'rating',value:1,max:5},
  {id:'photo',name:'Foto CFSE pel món',cat:'H',type:'sessions',value:5,max:10},
  {id:'watch',name:'Visualitzar un partit CFSE',cat:'H',type:'sessions',value:1,max:10}
];

async function ensureSummerChallenge(){
  const ref=doc(db,'challenges','summer-2026'); const s=await getDoc(ref);
  if(!s.exists() && canManageChallenges()) await setDoc(ref,{name:'Repte d’estiu 2026',minPoints:50,targetPoints:150,active:true,clubId:'ae-eixample',createdAt:serverTimestamp()});
  if(canManageChallenges()) for(const t of DEFAULT_TASKS){const tr=doc(db,'challengeTasks',t.id);if(!(await getDoc(tr)).exists())await setDoc(tr,{...t,challengeId:'summer-2026',active:true});}
}

async function renderChallenges(v){
  await ensureSummerChallenge();
  const taskSnap=await getDocs(collection(db,'challengeTasks'));
  const tasks=taskSnap.docs.map(d=>({id:d.id,...d.data()})).filter(t=>t.challengeId==='summer-2026'&&t.active!==false);

  if(canManageChallenges()){
    const subSnap=await getDocs(collection(db,'challengeSubmissions'));
    const subs=subSnap.docs.map(d=>({id:d.id,...d.data()}));
    v.innerHTML=`<div class="topbar"><div><h2>Repte d’estiu 2026</h2><p class="muted">Mínim 50 · Objectiu 150</p></div><button id="newChallengeBtn" class="btn primary">Nova prova</button></div>
    <div class="grid"><div class="card"><div class="muted">Proves actives</div><div class="metric">${tasks.length}</div></div><div class="card"><div class="muted">Registres</div><div class="metric">${subs.length}</div></div></div>
    <div id="challengeEditor"></div>
    <div class="card section"><h3>Proves actives</h3>${tasks.length?`<table class="table"><thead><tr><th>Prova</th><th>Àrea</th><th>Punts</th><th>Accions</th></tr></thead><tbody>${tasks.map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.cat)}</td><td>${t.value}</td><td><button class="btn ghost" data-edit-task="${t.id}">Editar</button> <button class="btn ghost" data-delete-task="${t.id}">Eliminar</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">No hi ha proves actives.</div>'}</div>`;

    const openEditor=(task=null)=>{
      const editor=document.getElementById('challengeEditor');
      editor.innerHTML=`<div class="card section"><h3>${task?'Editar prova':'Nova prova'}</h3><div class="field"><label>Nom</label><input id="challengeTaskName" value="${esc(task?.name||'')}"></div><div class="field"><label>Àrea</label><select id="challengeTaskCat"><option value="E">Entrenament</option><option value="T">Tècnic</option><option value="H">Hàbits</option></select></div><div class="field"><label>Punts</label><input id="challengeTaskValue" type="number" min="1" value="${Number(task?.value)||1}"></div><button id="saveChallengeTask" class="btn primary">Desar</button> <button id="cancelChallengeTask" class="btn ghost">Cancel·lar</button><div id="challengeTaskMsg"></div></div>`;
      document.getElementById('challengeTaskCat').value=task?.cat||'E';
      document.getElementById('cancelChallengeTask').onclick=()=>editor.innerHTML='';
      document.getElementById('saveChallengeTask').onclick=async()=>{
        const name=document.getElementById('challengeTaskName').value.trim();
        const cat=document.getElementById('challengeTaskCat').value;
        const value=Math.max(1,Number(document.getElementById('challengeTaskValue').value)||1);
        if(!name) return document.getElementById('challengeTaskMsg').innerHTML='<div class="error">Escriu el nom de la prova.</div>';
        const id=task?.id||('task-'+Date.now());
        await setDoc(doc(db,'challengeTasks',id),{challengeId:'summer-2026',name,cat,value,max:task?.max||999,type:task?.type||'sessions',active:true,updatedAt:serverTimestamp()},{merge:true});
        renderChallenges(v);
      };
    };
    document.getElementById('newChallengeBtn').onclick=()=>openEditor();
    document.querySelectorAll('[data-edit-task]').forEach(btn=>btn.onclick=()=>openEditor(tasks.find(t=>t.id===btn.dataset.editTask)));
    document.querySelectorAll('[data-delete-task]').forEach(btn=>btn.onclick=async()=>{if(confirm('Vols eliminar aquesta prova?')){await deleteDoc(doc(db,'challengeTasks',btn.dataset.deleteTask));renderChallenges(v);}});
    return;
  }

  if(isStaff()){
    v.innerHTML=`<div class="topbar"><div><h2>Repte d’estiu 2026</h2><p class="muted">Consulta de proves</p></div></div><div class="card section"><h3>Proves actives</h3><table class="table"><thead><tr><th>Prova</th><th>Àrea</th><th>Punts</th></tr></thead><tbody>${tasks.map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.cat)}</td><td>${t.value}</td></tr>`).join('')}</tbody></table></div>`;
    return;
  }

  const player=await getPlayer(state.profile?.playerId);
  if(!player) return placeholder(v,'Repte d’estiu','No hi ha cap jugador associat a aquest compte.');
  const qy=query(collection(db,'challengeSubmissions'),where('playerId','==',state.profile.playerId));
  const subSnap=await getDocs(qy),subs=subSnap.docs.map(d=>({id:d.id,...d.data()}));
  const totals={E:0,T:0,H:0,total:0}; subs.forEach(s=>{totals[s.cat]=(totals[s.cat]||0)+(+s.points||0);totals.total+=(+s.points||0);});
  v.innerHTML=`<div class="topbar"><div><h2>Repte d’estiu 2026</h2><p class="muted">${esc(player.name||'Jugador')} · mínim 50 · objectiu 150</p></div></div>
  <div class="grid"><div class="card"><div class="muted">Punts totals</div><div class="metric">${totals.total}</div></div><div class="card"><div class="muted">Entrenament</div><div class="metric">${totals.E}</div></div><div class="card"><div class="muted">Tècnic</div><div class="metric">${totals.T}</div></div><div class="card"><div class="muted">Hàbits</div><div class="metric">${totals.H}</div></div></div>
  <div class="card section"><h3>Registrar prova</h3><div class="field"><label>Prova</label><select id="taskSel">${tasks.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Quantitat / valoració</label><input id="taskQty" type="number" min="1" value="1"></div><div class="field"><label>Comentari o enllaç d’evidència</label><input id="taskNote" placeholder="Opcional: enllaç Drive, vídeo o comentari"></div><button id="submitTask" class="btn primary">Afegir punts</button><div id="taskMsg"></div></div>
  <div class="card section"><h3>Últims registres</h3>${subs.length?`<table class="table"><thead><tr><th>Prova</th><th>Punts</th><th>Data</th></tr></thead><tbody>${subs.slice().reverse().map(s=>`<tr><td>${esc(s.taskName)}</td><td>+${s.points}</td><td>${esc(fmtDate(s.createdAt))}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Encara no hi ha registres.</div>'}</div>`;
  document.getElementById('submitTask').onclick=async()=>{
    const task=tasks.find(t=>t.id===document.getElementById('taskSel').value);
    if(!task) return;
    const qty=Math.max(1,+document.getElementById('taskQty').value||1);
    const points=Math.min(task.max||999,qty*(+task.value||0));
    await addDoc(collection(db,'challengeSubmissions'),{challengeId:'summer-2026',taskId:task.id,taskName:task.name,cat:task.cat,quantity:qty,points,note:document.getElementById('taskNote').value.trim(),userId:state.currentUser.uid,playerId:state.profile.playerId,teamId:state.profile.teamId||null,status:'submitted',createdAt:serverTimestamp()});
    renderChallenges(v);
  };
}

function placeholder(v,t,x){v.innerHTML=`<div class="topbar"><h2>${esc(t)}</h2><span class="badge">Properament</span></div><div class="card"><p class="muted">${esc(x)}</p></div>`;}

onAuthStateChanged(auth,async user=>{
  state.currentUser=user;
  if(!user){state.profile=null;return authScreen();}
  try{
    state.profile=await loadProfile(user.uid);
    if(!state.profile){await signOut(auth);return authScreen('login','Aquest usuari no té perfil. Torna a crear el compte.','error');}
    state.currentView='dashboard'; shell(); renderView();
  }catch(e){console.error(e);authScreen('login','No s’ha pogut llegir el perfil. Revisa les regles de Firestore.','error');}
});
