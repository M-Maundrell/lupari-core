/*
  Lupari Ops - lógica operativa separada del markup.
  Basado en la versión estable del 5 de julio, conservando el mismo esquema de Firebase y los IDs del DOM.
*/

function getTodayISO() {
  var d = new Date();
  var tzoffset = d.getTimezoneOffset() * 60000;
  return (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 10);
}

function formatTime(timestamp) {
  if (!timestamp) return '--:--';
  var d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function triggerMobilePrint() {
  window.focus();
  setTimeout(function() { window.print(); }, 250);
}

var firebaseConfig = {
  apiKey: "AIzaSyAnmIfcDno4Vrfw7yNJcjgghG-MGmaKiNU",
  authDomain: "lupari-arboleda.firebaseapp.com",
  databaseURL: "https://lupari-arboleda-default-rtdb.firebaseio.com",
  projectId: "lupari-arboleda",
  storageBucket: "lupari-arboleda.firebasestorage.app",
  messagingSenderId: "721354048696",
  appId: "1:721354048696:web:8fea3af1c973d530fda04d"
};

if (window.firebase && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
var db = window.firebase ? firebase.database() : null;

var currentTab = 'prep_moto';
var userSession = { name: 'Operador de Barra', isAdmin: false };
var fallbackRestockProducts = [
  { default_code: 'INS-001', name: 'Leche entera' },
  { default_code: 'INS-002', name: 'Leche deslactosada' },
  { default_code: 'INS-003', name: 'Leche avena' },
  { default_code: 'INS-004', name: 'Leche almendra' },
  { default_code: 'INS-005', name: 'Huevo' },
  { default_code: 'INS-006', name: 'Pan' },
  { default_code: 'INS-007', name: 'Vasos 12oz' }
];
var firebaseRef = null;
var hasAutoFocused = false;
var isSpeaking = false;
var currentSpeakingBtnId = null;
var speechUtterance = null;
var collapsedSections = {};
var state = {
  fecha: '',
  punto: 'arboleda',
  phases: {
    prep_moto: { startTime: null, endTime: null, startedBy: null, checks: {}, notas: {}, notes: {} },
    apertura: { startTime: null, endTime: null, startedBy: null, checks: {}, notas: {}, notes: {} },
    cierre: { startTime: null, endTime: null, startedBy: null, checks: {}, notas: {}, notes: {} }
  },
  inventoryRestocks: {},
  dayClosed: false,
  dayClosedBy: null,
  dayClosedAt: null,
  dayClosedReportSentAt: null,
  dayClosureReport: null,
  structure: null
};

var DATA = {
  prep_moto: [
    { id:'veh', title:'Antes de Salir — Vehículo', items:[
      { id:'m01', label:'Moto: gasolina, batería, arranque en frío, chicote de velocidad' },
      { id:'m02', label:'Kit de pasacorriente y herramienta básica en la moto' },
      { id:'m03', label:'Al apagar el vehículo al llegar: luces apagadas' }
    ]},
    { id:'con', title:'Antes de Salir — Carga y conectividad', items:[
      { id:'m04', label:'Módem / WiFi portátil: cargado al 100% con su cable USB' },
      { id:'m05', label:'Tablet de Uber Eats: cargada y con datos o WiFi' },
      { id:'m06', label:'Terminal Clip (física): cargada' },
      { id:'m07', label:'Celular(es): mínimo 80% de batería' }
    ]},
    { id:'eq', title:'Antes de Salir — Equipo y mobiliario', items:[
      { id:'m08', label:'Sándwichera(s) — verificar que encienden antes de salir' },
      { id:'m09', label:'Extensión eléctrica + multicontacto' },
      { id:'m10', label:'Escoba y recogedor' },
      { id:'m11', label:'Sillas y tronco / mesa' },
      { id:'m12', label:'Letrero luminoso' },
      { id:'m13', label:'Gas butano — verificar nivel del cartucho' }
    ]},
    { id:'hiel', title:'Hielera — empacar noche anterior', items:[
      { id:'m14', label:'Leches: entera, deslactosada, avena, almendra' },
      { id:'m15', label:'Huevo — empacado en hielera (NO en la mañana)' },
      { id:'m17', label:'Tocino, queso gouda, queso cheddar, jamón, pavo' },
      { id:'m18', label:'Aguacate y limones' },
      { id:'m19', label:'Cold brew — en recipiente de PLÁSTICO (nunca vidrio en hielera)' },
      { id:'m20', label:'Foam de queso (si se preparó ayer): verificar menos de 24 hrs' },
      { id:'m21', label:'Crema para batir' },
      { id:'m22', label:'Garrafón de agua purificada' }
    ]},
    { id:'seco', title:'Insumos secos', items:[
      { id:'m23', label:'Pan dulce y bollos de masa madre en caja plástica rígida' },
      { id:'m24', label:'Vasos: 8oz, 12oz, 16oz calientes y transparentes' },
      { id:'m25', label:'Tapas, popotes, servilletas, bolsas de papel' },
      { id:'m26', label:'Bolsas para basura grandes' },
      { id:'m27', label:'Galletas Lupari (stock para venta)' },
      { id:'m28', label:'Matcha, Chai, Chocolate, Té, Tisana en botes herméticos' },
      { id:'m29', label:'Jarabes: vainilla, caramelo, avellana, fresa, canela, amareto, horchata' }
    ]}
  ],
  apertura: [
    { id:'mont', title:'Al llegar — Montaje', items:[
      { id:'a30', label:'Colocar lona / sombrilla / estructura inicial' },
      { id:'a31', label:'Acomodar mesa, sillas y tronco estables' },
      { id:'a32', label:'Montar barra de servicio limpia con trapo húmedo' },
      { id:'a33', label:'Conectar extensión eléctrica y ocultar cables para evitar tropiezos' },
      { id:'a34', label:'Colocar menú visible y letrero luminoso encendido' },
      { id:'a35', label:'Colocar bote de basura con bolsa limpia al alcance del cliente' }
    ]},
    { id:'barr', title:'Al llegar — Estación de Bebidas', items:[
      { id:'a36', label:'Encender máquina de espresso (esperar ciclo completo de calentamiento)' },
      { id:'a37', label:'Verificar nivel de agua limpia en el depósito de la máquina' },
      { id:'a38', label:'Montar molino con grano fresco (llenar tolva media capacidad)' },
      { id:'a39', label:'Purgar molino: tirar primer disparo para limpiar residuos de ayer' },
      { id:'a40', label:'Calibrar molienda: sacar un shot doble (test de caída 25-30 seg)' },
      { id:'a41', label:'Llenar termo de agua caliente para Americanos y Tés' },
      { id:'a42', label:'Colocar báscula y cronómetro listos en barra' },
      { id:'a43', label:'Acomodar jarras de pitch (chica, mediana) y trapo exclusivo para lanceta' },
      { id:'a44', label:'Disponer botes de Matcha/Chai/Chocolate con sus cucharas medidoras' }
    ]},
    { id:'coc', title:'Al llegar — Estación de Alimentos', items:[
      { id:'a45', label:'Limpiar sándwichera y precalentar a temperatura de operación' },
      { id:'a46', label:'Disponer tabla de corte desinfectada y cuchillo de pan' },
      { id:'a47', label:'Montar recipientes con pinzas: jamón, tocino, quesos' },
      { id:'a48', label:'Preparar base de guacamole del día (aguacate + limón + sal)' },
      { id:'a49', label:'Colocar mayonesa y aderezos con su respectiva cuchara/mamilas' },
      { id:'a50', label:'Verificar que el pan esté fresco y protegido del polvo' }
    ]},
    { id:'ope', title:'Apertura oficial', items:[
      { id:'a51', label:'Abrir app de Uber Eats / DiDi Food (verificar menú activo y precios)' },
      { id:'a52', label:'Encender terminal Clip y verificar enlace bluetooth con celular' },
      { id:'a53', label:'Contar fondo de caja (registrar monto exacto en notas si difiere)' },
      { id:'a54', label:'Barista e integrantes con mandil puesto y manos lavadas' },
      { id:'a55', label:'Enviar mensaje al grupo: APERTURA COMPLETADA - [Punto de venta]' }
    ]}
  ],
  cierre: [
    { id:'apps', title:'Cierre digital y comercial', items:[
      { id:'c01', label:'Cerrar sesión / apagar Uber Eats y DiDi Food puntualmente' },
      { id:'c02', label:'Apagar terminal Clip y guardarla en su estuche' },
      { id:'c03', label:'Realizar corte de caja final (contar efectivo vs reporte de ventas)' },
      { id:'c04', label:'Separar fondo de caja base para mañana y meterlo en su bolsa' },
      { id:'c05', label:'Registrar ventas totales y cualquier descuadre en la sección de notas' }
    ]},
    { id:'maqa', title:'Limpieza Barra — Máquina y Molino', items:[
      { id:'c06', label:'Backflush de la máquina de espresso con filtro ciego (3 ciclos agua)' },
      { id:'c07', label:'Limpiar grupos con cepillo para retirar restos de café' },
      { id:'c08', label:'Limpiar lanceta de vapor a fondo, purgar y dejar brillante sin costras' },
      { id:'c10', label:'Encender molino vacío para sacar todo el residuo de la cámara' },
      { id:'c11', label:'Limpiar charola de goteo de la máquina y vaciar residuos' }
    ]},
    { id:'ut', title:'Limpieza Barra — Utensilios y Secos', items:[
      { id:'c12', label:'Lavar jarras (pitchers), vasos medidores, cucharas y porta-filtros' },
      { id:'c13', label:'Lavar y secar báscula (revisar que no quede mojada)' },
      { id:'c14', label:'Cerrar botes de Matcha, Chai, Chocolate bien herméticos' },
      { id:'c15', label:'Limpiar barra completa con desinfectante multiusos' }
    ]},
    { id:'coc_c', title:'Limpieza Cocina y Alimentos', items:[
      { id:'c16', label:'Apagar y desenchufar sándwichera' },
      { id:'c17', label:'Limpiar placas de la sándwichera (retirar grasa/queso quemado)' },
      { id:'c18', label:'Tirar sobrante de guacamole del día (NO se guarda para mañana)' },
      { id:'c19', label:'Lavar tabla de corte, cuchillos, pinzas y recipientes usados' },
      { id:'c20', label:'Guardar pan sobrante bien cerrado para evitar que se endurezca' }
    ]},
    { id:'hiel_c', title:'Desmontaje y Hielera', items:[
      { id:'c21', label:'Guardar lácteos, huevo, jamón, tocino y quesos ordenados en hielera' },
      { id:'c22', label:'Asegurar que los geles congelados / hielo mantengan frío el producto' },
      { id:'c23', label:'Vaciar agua residual del termo caliente' },
      { id:'c24', label:'Desconectar extensión eléctrica, enrollar limpia y sin nudos' },
      { id:'c25', label:'Apagar letrero luminoso y guardarlo protegido' },
      { id:'c26', label:'Plegar mesas, sillas y estructura de lona con cuidado' }
    ]},
    { id:'fin', title:'Finalización', items:[
      { id:'c27', label:'Amarrar bolsa de basura del día y dejarla en zona de recolección' },
      { id:'c28', label:'Verificar que el área pública quede impecable (sin servilletas ni basura)' },
      { id:'c29', label:'Cargar mobiliario y cajas seguro en el vehículo de transporte' },
      { id:'c30', label:'Revisar área final: nada de objetos olvidados en el piso' },
      { id:'c31', label:'Enviar mensaje al grupo: CIERRE COMPLETADO - Reporte de Caja OK' }
    ]}
  ]
};

function applyUserBadge() {
  var nameInput = document.getElementById('user-display-name');
  if (nameInput) {
    nameInput.value = userSession.name || 'Operador de Barra';
  }

  var roleEl = document.getElementById('user-display-role');
  if (roleEl) {
    if (userSession.isAdmin) {
      roleEl.textContent = 'Admin';
      roleEl.className = 'user-role role-admin';
    } else {
      roleEl.textContent = 'Operador';
      roleEl.className = 'user-role role-colab';
    }
  }
}

function getResolvedUserName(sessionInfo) {
  if (!sessionInfo) return null;

  var candidates = [];
  if (typeof sessionInfo === 'object') {
    candidates.push(sessionInfo.name, sessionInfo.partner_display_name, sessionInfo.username, sessionInfo.user_name, sessionInfo.user_login, sessionInfo.login, sessionInfo.full_name);
    if (sessionInfo.user && typeof sessionInfo.user === 'object') {
      candidates.push(sessionInfo.user.name, sessionInfo.user.full_name, sessionInfo.user.username, sessionInfo.user.login);
    }
    if (sessionInfo.session_info && typeof sessionInfo.session_info === 'object') {
      candidates.push(sessionInfo.session_info.name, sessionInfo.session_info.partner_display_name, sessionInfo.session_info.username, sessionInfo.session_info.user_name, sessionInfo.session_info.user_login);
    }
  }

  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function toggleSectionCollapse(sectionId) {
  collapsedSections[sectionId] = !collapsedSections[sectionId];
  renderContent();
}

function updateTimeUI() {
  var pData = state.phases[currentTab] || { startTime: null, endTime: null };
  var startEl = document.getElementById('time-start');
  var endEl = document.getElementById('time-end');
  if (startEl) startEl.textContent = formatTime(pData.startTime);
  if (endEl) endEl.textContent = formatTime(pData.endTime);

  var durationEl = document.getElementById('time-duration');
  if (durationEl) {
    if (pData.startTime) {
      var end = pData.endTime ? pData.endTime : Date.now();
      var diffMins = Math.round((end - pData.startTime) / 60000);
      durationEl.textContent = (diffMins < 0 ? 0 : diffMins) + ' min';
    } else {
      durationEl.textContent = '0 min';
    }
  }
}

function updateWizardStatus() {
  var keys = ['prep_moto', 'apertura', 'cierre'];
  keys.forEach(function(k) {
    var pData = state.phases[k] || { startTime: null, endTime: null, checks: {} };
    var labelEl = document.getElementById('status-' + k); if (!labelEl) return;
    var total = 0, done = 0;

    var activeStruct = (state.structure && state.structure[k]) ? state.structure[k] : DATA[k];
    activeStruct.forEach(function(s){ s.items.forEach(function(i){ total++; if(pData.checks && pData.checks[i.id] && pData.checks[i.id].checked) done++; })});

    if (pData.endTime) {
      labelEl.innerHTML = 'Listo ✓'; labelEl.style.color = 'var(--accent-green)';
    } else if (pData.startTime || k === currentTab) {
      labelEl.innerHTML = 'En proceso ⏳'; labelEl.style.color = 'var(--accent-blue)';
    } else {
      labelEl.innerHTML = 'Pendiente 🔒'; labelEl.style.color = 'var(--text-muted)';
    }
  });

  var flowBtn = document.getElementById('btn-next-phase');
  var isCurrentLocked = !!(state.phases[currentTab] && state.phases[currentTab].endTime);

  if (!isCurrentLocked && currentTab === 'prep_moto') {
    if (flowBtn) {
      flowBtn.innerHTML = 'Fase 1 completada. Cerrar y pasar a Apertura ➔'; flowBtn.style.display = 'flex';
    }
  } else if (!isCurrentLocked && currentTab === 'apertura') {
    if (flowBtn) {
      flowBtn.innerHTML = 'Fase 2 completada. Cerrar y pasar a Cierre ➔'; flowBtn.style.display = 'flex';
    }
  } else if (flowBtn) {
    flowBtn.style.display = 'none';
  }
}

function updateProgress() {
  var pData = state.phases[currentTab] || { checks: {} }; var total = 0, done = 0;
  var activeStruct = (state.structure && state.structure[currentTab]) ? state.structure[currentTab] : DATA[currentTab];

  activeStruct.forEach(function(sec) {
    sec.items.forEach(function(item) { total++; if (pData.checks && pData.checks[item.id] && pData.checks[item.id].checked) done++; });
  });

  var pct = total > 0 ? Math.round((done / total) * 100) : 0;
  var pctDisplay = document.getElementById('kpi-pct-display');
  var counterDisplay = document.getElementById('kpi-counter-display');
  var barFill = document.getElementById('kpi-bar-fill');

  if (pctDisplay) { pctDisplay.textContent = pct + '%'; pctDisplay.classList.toggle('done', pct === 100); }
  if (counterDisplay) { counterDisplay.textContent = done + ' / ' + total + ' Tareas'; }
  if (barFill) { barFill.style.width = pct + '%'; barFill.classList.toggle('done', pct === 100); }
}

function renderContent() {
  var container = document.getElementById('content'); if (!container) return;
  var pData = state.phases[currentTab] || { startTime: null, endTime: null, checks: {}, startedBy: null };

  renderDayClosureControl();
  applyOperationalEditLock();

  var isLocked = !!pData.endTime;
  var isStarted = !!pData.startTime;
  var query = document.getElementById('search-input') ? document.getElementById('search-input').value.toLowerCase() : '';
  var html = '';

  var startBtn = document.getElementById('btn-time-control');
  var adminZone = document.getElementById('admin-time-override-zone');
  var badgeEl = document.getElementById('started-by-badge');

  if (startBtn) {
    if (isLocked) {
      startBtn.textContent = '🔒 Fase Completada y Sellada';
      startBtn.className = 'btn-time-starter started';
    } else if (isStarted) {
      startBtn.textContent = '🟢 Checklist Iniciado';
      startBtn.className = 'btn-time-starter started';
    } else {
      var namesMap = { prep_moto: 'Fase 1: Prep. Moto', apertura: 'Fase 2: Apertura', cierre: 'Fase 3: Cierre' };
      startBtn.innerHTML = '▶️ Empezar Checklist ' + (namesMap[currentTab] || currentTab);
      startBtn.className = 'btn-time-starter';
    }
  }

  if (badgeEl) {
    if (isStarted && !isLocked) {
      badgeEl.innerHTML = '👤 Iniciado por: ' + (pData.startedBy || 'Operador') + ' (' + formatTime(pData.startTime) + ')';
      badgeEl.style.display = 'block';
    } else {
      badgeEl.style.display = 'none';
    }
  }

  if (userSession.isAdmin) {
    if (adminZone) {
      adminZone.innerHTML = '<button class="btn-admin-override" style="color:var(--accent-amber);" onclick="pausePhaseTime()">⏸️ Pausar</button>' +
        '<button class="btn-admin-override" style="color:var(--accent-red);" onclick="resetPhaseTime()">🔄 Reiniciar</button>';
    }
  } else if (adminZone) {
    adminZone.innerHTML = '';
  }

  var masterZone = document.getElementById('admin-master-zone');
  if (masterZone) {
    masterZone.innerHTML = userSession.isAdmin ? '<button class="btn-admin-master-add" onclick="addAdminCategory()">+ Crear Nueva Categoría / Sección</button>' : '';
  }

  if (isLocked) {
    html += '<div class="phase-lock-banner"><span>🔒 Esta fase está cerrada. No se permiten modificaciones en tareas.</span>';
    if (userSession.isAdmin) { html += '<button class="btn-unlock-phase" onclick="unlockActivePhase()">🔓 Desbloquear</button>'; }
    html += '</div>';
  }

  if (isDayClosureLocked()) {
    html += '<div class="phase-lock-banner"><span>🔒 El día ya fue cerrado. Solo los admins pueden seguir editando.</span></div>';
  }

  var activeStruct = (state.structure && state.structure[currentTab]) ? state.structure[currentTab] : DATA[currentTab];

  activeStruct.forEach(function(sec) {
    if (!sec.items) sec.items = [];
    var filtered = sec.items.filter(function(i) { return i.label.toLowerCase().includes(query) || sec.title.toLowerCase().includes(query); });
    if (filtered.length === 0 && query !== '') return;
    var sTotal = sec.items.length; var sDone = sec.items.filter(function(i){ return pData.checks && pData.checks[i.id] && pData.checks[i.id].checked; }).length;

    var isCollapsed = !!collapsedSections[sec.id];
    var arrowIndicator = isCollapsed ? '►' : '▼';
    var bodyClass = isCollapsed ? 'section-collapsible-body is-collapsed' : 'section-collapsible-body';

    html += '<div class="section">';
    html += '<div class="section-hdr" onclick="toggleSectionCollapse(\'' + sec.id + '\')">';
    html += '<div class="section-hdr-left">';
    html += '<span class="section-collapse-indicator">' + arrowIndicator + '</span>';
    html += '<h3>' + sec.title + '</h3>';

    var speakBtnId = 'v-btn-' + sec.id;
    html += '<button class="btn-category-voice" id="' + speakBtnId + '" onclick="event.stopPropagation(); toggleCategoryVoice(\'' + sec.id + '\')">🎙️ Asistente</button>';
    html += '</div>';

    html += '<div class="section-hdr-right">';
    html += '<span class="section-count ' + (sDone === sTotal ? 'done' : '') + '">' + sDone + ' / ' + sTotal + '</span>';

    if (userSession.isAdmin) {
      html += '<button class="btn-admin-action" onclick="event.stopPropagation(); editAdminCategory(\'' + sec.id + '\')">✏️</button>';
      html += '<button class="btn-admin-action" style="color:var(--accent-red);" onclick="event.stopPropagation(); deleteAdminCategory(\'' + sec.id + '\')">🗑️</button>';
    }
    html += '</div></div>';

    html += '<div class="' + bodyClass + '">';
    html += '<div class="check-list">';

    filtered.forEach(function(item) {
      var cRecord = pData.checks ? pData.checks[item.id] : null; var isChecked = cRecord && cRecord.checked;

      var isActionDisabled = isLocked || !isStarted || isDayClosureLocked();
      var itemAction = isActionDisabled ? '' : 'onclick="toggleCheck(\'' + item.id + '\', \'' + item.label.replace(/'/g, "\\'") + '\')"';
      var checkDisabled = isActionDisabled ? 'disabled' : '';
      var visualClass = !isStarted ? 'check-item disabled-blueprint' : 'check-item';

      html += '<div class="' + visualClass + ' ' + (isChecked ? 'is-checked' : '') + '" ' + itemAction + '>';
      html += '<div class="check-item-left">';
      html += '<div class="check-box"><input type="checkbox" ' + (isChecked ? 'checked' : '') + ' ' + checkDisabled + ' onclick="event.stopPropagation(); if(!' + isActionDisabled + ') toggleCheck(\'' + item.id + '\', \'' + item.label.replace(/'/g, "\\'") + '\')"></div>';
      html += '<div class="check-text-container"><div class="check-text">' + item.label + '</div>';
      if (isChecked && cRecord.user) { html += '<div class="check-signature">✓ por ' + cRecord.user + ' (' + formatTime(cRecord.timestamp) + ')</div>'; }
      html += '</div></div>';

      if (userSession.isAdmin) {
        html += '<div class="admin-actions-wrap">';
        html += '<button class="btn-admin-action" onclick="event.stopPropagation(); editAdminTask(\'' + sec.id + '\', \'' + item.id + '\')">✏️</button>';
        html += '<button class="btn-admin-action" style="color:var(--accent-red);" onclick="event.stopPropagation(); deleteAdminTask(\'' + sec.id + '\', \'' + item.id + '\')">🗑️</button>';
        html += '</div>';
      }

      html += '</div>';
    });
    html += '</div>';

    if (userSession.isAdmin) {
      html += '<button class="btn-admin-add" onclick="addAdminTask(\'' + sec.id + '\')">+ Agregar Tarea a sección</button>';
    }
    html += '</div></div>';
  });
  container.innerHTML = html;
}

async function detectOdooUser() {
  var savedName = localStorage.getItem('lupari_ops_username');
  if (savedName) { userSession.name = savedName; }

  if (localStorage.getItem('lupari_ops_is_admin') === '1') { userSession.isAdmin = true; }

  if (window.location.protocol === 'file:') {
    console.warn('[LUPARI DEBUGER] Ejecución local detectada. Simulando entorno Odoo.');
    userSession.isAdmin = true;
    userSession.name = 'Mario Admin Local';
    localStorage.setItem('lupari_ops_username', userSession.name);
    localStorage.setItem('lupari_ops_is_admin', '1');
    applyUserBadge();
    return;
  }

  try {
    var response = await fetch('/web/session/get_session_info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'same-origin',
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {} })
    });

    if (!response.ok) throw new Error('Falla en red');

    var jsonResponse = await response.json();
    var rootInfo = jsonResponse && (jsonResponse.result || jsonResponse.session_info || jsonResponse.info || jsonResponse);

    if (rootInfo) {
      var detectedName = getResolvedUserName(rootInfo);
      if (detectedName) {
        userSession.name = detectedName;
        localStorage.setItem('lupari_ops_username', detectedName);
      }
      userSession.isAdmin = isAdminSession(rootInfo);
      if (userSession.isAdmin) {
        localStorage.setItem('lupari_ops_is_admin', '1');
      } else {
        localStorage.removeItem('lupari_ops_is_admin');
      }
    }
  } catch (e) {
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('role') === 'admin') userSession.isAdmin = true;
    if (urlParams.get('user')) userSession.name = urlParams.get('user');
  }

  applyUserBadge();
}

function escapeHtml(text) {
  return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function canEditEntry(entry) {
  if (!entry) return false;
  return userSession.isAdmin || !entry.user || entry.user === userSession.name;
}

function isDayClosureLocked() {
  return !!state.dayClosed && !userSession.isAdmin;
}

function canEditOperationalData() {
  return userSession.isAdmin || !isDayClosureLocked();
}

function applyOperationalEditLock() {
  var isLocked = isDayClosureLocked();
  var noteInput = document.getElementById('notes-input');
  var noteButton = document.querySelector('.notes-input-row .btn-add-note');
  var restockSelect = document.getElementById('restock-product-select');
  var restockUnit = document.getElementById('restock-unit-select');
  var restockQty = document.getElementById('restock-quantity');
  var restockComment = document.getElementById('restock-comment');
  var restockCustom = document.getElementById('restock-custom-product');
  var restockButton = document.querySelector('.restock-form .btn-add-note');

  if (noteInput) noteInput.disabled = isLocked;
  if (noteButton) {
    noteButton.disabled = isLocked;
    noteButton.style.opacity = isLocked ? '0.7' : '';
    noteButton.style.cursor = isLocked ? 'not-allowed' : '';
  }

  if (restockSelect) restockSelect.disabled = isLocked;
  if (restockUnit) restockUnit.disabled = isLocked;
  if (restockQty) restockQty.disabled = isLocked;
  if (restockComment) restockComment.disabled = isLocked;
  if (restockCustom) restockCustom.disabled = isLocked;
  if (restockButton) {
    restockButton.disabled = isLocked;
    restockButton.style.opacity = isLocked ? '0.7' : '';
    restockButton.style.cursor = isLocked ? 'not-allowed' : '';
  }
}

function getPhaseCompletionStats(phaseKey) {
  var pData = state.phases && state.phases[phaseKey] ? state.phases[phaseKey] : { checks: {} };
  var total = 0;
  var done = 0;
  var activeStruct = (state.structure && state.structure[phaseKey]) ? state.structure[phaseKey] : DATA[phaseKey];

  if (!activeStruct) return { total: 0, done: 0, complete: false };
  activeStruct.forEach(function(sec) {
    if (!sec || !sec.items) return;
    sec.items.forEach(function(item) {
      total++;
      if (pData.checks && pData.checks[item.id] && pData.checks[item.id].checked) done++;
    });
  });

  return { total: total, done: done, complete: total > 0 && done === total };
}

function areAllPhasesComplete() {
  return ['prep_moto', 'apertura', 'cierre'].every(function(phaseKey) {
    return getPhaseCompletionStats(phaseKey).complete;
  });
}

function renderDayClosureControl() {
  var zone = document.getElementById('day-close-zone');
  if (!zone) return;

  if (currentTab !== 'cierre') {
    zone.innerHTML = '';
    return;
  }

  var isClosed = !!state.dayClosed;
  var statusText = isClosed
    ? ('Día cerrado por ' + escapeHtml(state.dayClosedBy || 'usuario') + ' · ' + escapeHtml(formatTime(state.dayClosedAt)))
    : 'Las 3 fases deben completarse al 100% antes de realizar el cierre definitivo del día.';
  var buttonLabel = isClosed ? '✅ Día cerrado' : '🛑 Terminar día';
  var disabledAttr = isClosed ? 'disabled' : '';

  var html = '<button id="btn-day-close" class="day-close-btn' + (isClosed ? ' is-closed' : '') + '" ' + disabledAttr + ' onclick="finishDayAndNotifyOdoo()">' + buttonLabel + '</button>' +
    '<div class="day-close-status">' + statusText + '</div>';

  if (isClosed && userSession.isAdmin) {
    html += '<button class="btn-admin-override" style="margin-top:10px; width:100%; color:var(--accent-amber); border-color:var(--accent-amber);" onclick="reopenDay()">🔓 Reabrir Día (Admin)</button>';
  }

  zone.innerHTML = html;
}

function buildDayClosureHTMLFile(closeTimestamp) {
  var phaseNames = { prep_moto: 'Fase 1: Prep. Moto', apertura: 'Fase 2: Apertura', cierre: 'Fase 3: Cierre' };
  var restocks = state.inventoryRestocks || {};
  var restockEntries = Object.keys(restocks).map(function(key) {
    return Object.assign({ _key: key }, restocks[key]);
  }).sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

  var restockLines = restockEntries.length ? restockEntries.map(function(entry) {
    return '<li>' + escapeHtml(entry.product || 'Sin producto') + ': ' + escapeHtml(entry.quantity || 0) + ' ' + escapeHtml(entry.unit || 'unidad') + (entry.comment ? ' | ' + escapeHtml(entry.comment) : '') + '</li>';
  }) : ['<li>Sin reabastecimientos reportados.</li>'];

  var incidenceHtml = '';
  ['prep_moto', 'apertura', 'cierre'].forEach(function(phaseKey) {
    var phaseData = state.phases && state.phases[phaseKey] ? state.phases[phaseKey] : {};
    var notes = phaseData.notas || phaseData.notes || {};
    var noteLines = Object.keys(notes).map(function(key) {
      var note = notes[key] || {};
      return '<li>' + escapeHtml((note.text || '').trim()) + '</li>';
    }).filter(function(line) { return !!line && line !== '<li></li>'; });

    incidenceHtml += '<div class="phase-title">' + phaseNames[phaseKey] + '</div>';
    if (noteLines.length) {
      incidenceHtml += '<ul>' + noteLines.join('') + '</ul>';
    } else {
      incidenceHtml += '<ul><li>Sin incidencias.</li></ul>';
    }
  });

  var closeTime = new Date(closeTimestamp).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  var sucursalMap = { arboleda: 'Arboleda', central: 'Central Sabor' };
  var sucursalName = sucursalMap[state.punto] || state.punto;

  var html = [
    '<div style="background-color: #f4f4f7; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; color: #333333; width: 100%; box-sizing: border-box;">',
    '  <style>',
    '    .report-card {',
    '      max-width: 600px;',
    '      margin: 0 auto;',
    '      background: #ffffff;',
    '      border-radius: 12px;',
    '      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);',
    '      border: 1px solid #e4e4e7;',
    '      overflow: hidden;',
    '    }',
    '    .header {',
    '      background: #09090b;',
    '      color: #ffffff;',
    '      padding: 24px;',
    '      text-align: center;',
    '    }',
    '    .header h1 {',
    '      margin: 0;',
    '      font-size: 20px;',
    '      font-weight: 700;',
    '      letter-spacing: -0.5px;',
    '    }',
    '    .header p {',
    '      margin: 4px 0 0;',
    '      font-size: 13px;',
    '      color: #a1a1aa;',
    '    }',
    '    .content {',
    '      padding: 24px;',
    '    }',
    '    .section-title {',
    '      font-size: 14px;',
    '      font-weight: 700;',
    '      text-transform: uppercase;',
    '      letter-spacing: 0.5px;',
    '      color: #09090b;',
    '      margin-top: 24px;',
    '      margin-bottom: 12px;',
    '      border-bottom: 2px solid #e4e4e7;',
    '      padding-bottom: 6px;',
    '    }',
    '    .section-title:first-child {',
    '      margin-top: 0;',
    '    }',
    '    ul {',
    '      margin: 0 0 16px 0;',
    '      padding-left: 20px;',
    '      line-height: 1.5;',
    '    }',
    '    li {',
    '      margin-bottom: 8px;',
    '      font-size: 14px;',
    '    }',
    '    .phase-title {',
    '      font-size: 13px;',
    '      font-weight: 700;',
    '      color: #3b82f6;',
    '      margin: 12px 0 6px 0;',
    '    }',
    '    .footer {',
    '      background: #f4f4f7;',
    '      padding: 16px 24px;',
    '      border-top: 1px solid #e4e4e7;',
    '      text-align: center;',
    '      font-size: 12px;',
    '      color: #71717a;',
    '    }',
    '  </style>',
    '  <div class="report-card">',
    '    <div class="header">',
    '      <h1>Reporte de Cierre de Día</h1>',
    '      <p>Lupari - ' + sucursalName + ' | ' + state.fecha + '</p>',
    '    </div>',
    '    <div class="content">',
    '      <div class="section-title">Reporte de Reabastecimiento</div>',
    '      <ul>' + restockLines.join('') + '</ul>',
    '      ',
    '      <div class="section-title">Reporte de Incidencias</div>',
    '      ' + incidenceHtml,
    '    </div>',
    '    <div class="footer">',
    '      <strong>Hora de Cierre:</strong> ' + closeTime + ' · Lupari Ops',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');

  return html;
}

function buildDayClosureReport(closeTimestamp) {
  var phaseNames = { prep_moto: 'Fase 1: Prep. Moto', apertura: 'Fase 2: Apertura', cierre: 'Fase 3: Cierre' };
  var restocks = state.inventoryRestocks || {};
  var restockEntries = Object.keys(restocks).map(function(key) {
    return Object.assign({ _key: key }, restocks[key]);
  }).sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

  var restockLines = restockEntries.length ? restockEntries.map(function(entry) {
    return '• ' + (entry.product || 'Sin producto') + ': ' + (entry.quantity || 0) + ' ' + (entry.unit || 'unidad') + (entry.comment ? ' | ' + entry.comment : '');
  }) : ['• Sin reabastecimientos reportados.'];

  var incidenceSections = [];
  ['prep_moto', 'apertura', 'cierre'].forEach(function(phaseKey) {
    var phaseData = state.phases && state.phases[phaseKey] ? state.phases[phaseKey] : {};
    var notes = phaseData.notas || phaseData.notes || {};
    var noteLines = Object.keys(notes).map(function(key) {
      var note = notes[key] || {};
      return '• ' + (note.text || '').trim();
    }).filter(function(line) { return line !== '• '; });

    incidenceSections.push(phaseNames[phaseKey] + ':');
    if (noteLines.length) {
      incidenceSections = incidenceSections.concat(noteLines);
    } else {
      incidenceSections.push('• Sin incidencias.');
    }
  });

  var closeTime = new Date(closeTimestamp).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  var sucursalMap = { arboleda: 'Arboleda', central: 'Central Sabor' };
  var sucursalName = sucursalMap[state.punto] || state.punto;

  var body = [
    '@everyone',
    'Reporte de Reabastecimiento (' + sucursalName + ' - ' + (state.fecha || getTodayISO()) + '):',
    restockLines.join('\n'),
    '',
    'Reporte de Incidencias:',
    incidenceSections.join('\n'),
    '',
    'Hora de Cierre: ' + closeTime
  ].join('\n');

  var htmlFileContent = buildDayClosureHTMLFile(closeTimestamp);

  return {
    subject: 'Reporte de cierre de día Lupari Ops',
    body: body,
    htmlFileContent: htmlFileContent,
    point: state.punto || 'arboleda',
    date: state.fecha || getTodayISO(),
    timestamp: closeTimestamp
  };
}

async function sendDayClosureReportToOdoo(report) {
  var isLocal = (window.location.protocol === 'file:');
  var channelId = isLocal ? 999 : (window.LUPARI_ODDO_CHANNEL_ID || window.LUPARI_ODOO_CHANNEL_ID || null);
  var headers = { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };

  var sucursalMap = { arboleda: 'Arboleda', central: 'Central Sabor' };
  var sucursalName = sucursalMap[report.point] || report.point;
  var mentionText = '@everyone Adjunto está el reporte de cierre del día ' + report.date + ' de Lupari-' + sucursalName;

  var attachmentId = null;
  var filename = 'Reporte_Cierre_' + report.date + '_' + sucursalName;

  if (channelId && report.htmlFileContent) {
    try {
      var base64Data = null;

      var jsPDFClass = window.jsPDF || (window.jspdf && window.jspdf.jsPDF);
      if (jsPDFClass) {
        // 1. Generar el PDF usando jsPDF de forma nativa en memoria (evitando fallas de html2canvas en iframes)
        console.log('Generando reporte PDF vectorial en memoria con jsPDF...');
        
        var doc = new jsPDFClass({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        var margin = 15;
        var y = 20;

        // Helper para imprimir líneas con envoltura de texto automática y paginación
        function printLine(text, indent) {
          var lines = doc.splitTextToSize(text, 175 - indent);
          lines.forEach(function(line) {
            if (y > 255) {
              doc.addPage();
              y = 20;
            }
            doc.text(line, margin + indent, y);
            y += 6;
          });
        }

        // Encabezado
        doc.setFillColor(9, 9, 11); // #09090b (Carbono)
        doc.rect(margin, y, 180, 25, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(15);
        doc.text("Reporte de Cierre de Día", margin + 10, y + 10);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(161, 161, 170); // #a1a1aa (Gris)
        doc.text("Lupari - " + sucursalName + " | " + report.date, margin + 10, y + 18);

        y += 35;

        // Sección: Reabastecimiento
        doc.setFillColor(9, 9, 11);
        doc.setTextColor(9, 9, 11);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.text("REPORTE DE REABASTECIMIENTO", margin, y);
        doc.setDrawColor(228, 228, 231); // #e4e4e7
        doc.setLineWidth(0.5);
        doc.line(margin, y + 2, margin + 180, y + 2);
        y += 8;

        var restocks = state.inventoryRestocks || {};
        var restockEntries = Object.keys(restocks).map(function(key) {
          return Object.assign({ _key: key }, restocks[key]);
        }).sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(39, 39, 42); // #27272a
        if (restockEntries.length) {
          restockEntries.forEach(function(entry) {
            var line = "• " + (entry.product || 'Sin producto') + ": " + (entry.quantity || 0) + " " + (entry.unit || 'unidad') + (entry.comment ? " | " + entry.comment : "");
            printLine(line, 5);
          });
        } else {
          printLine("• Sin reabastecimientos reportados.", 5);
        }

        y += 6;

        // Sección: Incidencias
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(9, 9, 11);
        doc.text("REPORTE DE INCIDENCIAS", margin, y);
        doc.line(margin, y + 2, margin + 180, y + 2);
        y += 8;

        var phaseNames = { prep_moto: 'Fase 1: Prep. Moto', apertura: 'Fase 2: Apertura', cierre: 'Fase 3: Cierre' };
        ['prep_moto', 'apertura', 'cierre'].forEach(function(phaseKey) {
          var phaseData = state.phases && state.phases[phaseKey] ? state.phases[phaseKey] : {};
          var notes = phaseData.notas || phaseData.notes || {};
          var noteLines = Object.keys(notes).map(function(key) {
            var note = notes[key] || {};
            return "• " + (note.text || '').trim();
          }).filter(function(line) { return line !== "• "; });

          if (y > 240) { doc.addPage(); y = 20; }
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(59, 130, 246); // #3b82f6 (Azul)
          doc.text(phaseNames[phaseKey], margin + 2, y);
          y += 5;

          doc.setFont('Helvetica', 'normal');
          doc.setTextColor(39, 39, 42);
          if (noteLines.length) {
            noteLines.forEach(function(line) {
              printLine(line, 5);
            });
          } else {
            printLine("• Sin incidencias.", 5);
          }
          y += 2;
        });

        // Pie de Página
        if (y > 260) { doc.addPage(); y = 20; }
        y = 270;
        var closeTimestamp = state.phases.cierre.endTime || Date.now();
        var closeTime = new Date(closeTimestamp).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
        doc.setFillColor(244, 244, 247); // #f4f4f7
        doc.rect(margin, y, 180, 12, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(113, 113, 122); // #71717a
        doc.text("Hora de Cierre: " + closeTime + " · Lupari Ops", margin + 10, y + 8);

        var pdfDataUri = doc.output('datauristring');

        if (pdfDataUri && pdfDataUri.indexOf('base64,') !== -1) {
          base64Data = pdfDataUri.split('base64,')[1];
        }

        filename += '.pdf';
        console.log('PDF generado exitosamente (jsPDF). Tamaño base64:', base64Data ? base64Data.length : 0);

        if (isLocal) {
          console.log('[LUPARI DEBUGER] Ejecución local. Guardando PDF para depuración.');
          try {
            doc.save(filename);
          } catch (saveErr) {
            console.error('Falla al guardar localmente en test:', saveErr);
          }
          return;
        }


      } else {
        // Fallback a HTML si jsPDF no está cargado
        console.warn('jsPDF no está disponible. Usando fallback de HTML.');
        base64Data = btoa(unescape(encodeURIComponent(report.htmlFileContent)));
        filename += '.html';
        if (isLocal) {
          console.log('[LUPARI DEBUGER] Fallback local. Contenido base64:', base64Data);
          return;
        }
      }

      if (base64Data) {
        // 2. Crear el archivo adjunto en Odoo (sin vincular a discuss.channel inicialmente para evitar AccessError)
        var attachResponse = await fetch('/web/dataset/call_kw/ir.attachment/create', {
          method: 'POST',
          headers: headers,
          credentials: 'same-origin',
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'ir.attachment',
              method: 'create',
              args: [{
                name: filename,
                type: 'binary',
                datas: base64Data,
                res_model: false,
                res_id: 0
              }],
              kwargs: {}
            }
          })
        });

        if (attachResponse.ok) {
          var attachJson = await attachResponse.json();
          if (attachJson && attachJson.result) {
            attachmentId = attachJson.result;
            console.log('Adjunto creado en Odoo exitosamente. ID:', attachmentId);
          } else {
            console.warn('Error al crear adjunto en Odoo:', attachJson.error);
            var errStr = attachJson.error ? (attachJson.error.message || JSON.stringify(attachJson.error)) : 'Respuesta sin resultado';
            alert('⚠️ Odoo rechazó la creación del archivo adjunto:\n' + errStr);
          }
        } else {
          console.warn('attachResponse not OK:', attachResponse.status);
          alert('⚠️ Error de red al subir adjunto a Odoo. Estatus: ' + attachResponse.status);
        }
      }
    } catch (err) {
      console.warn('Falla al crear adjunto en Odoo:', err);
    }
  }

  // Si pudimos crear el archivo adjunto (PDF o HTML), el cuerpo del mensaje será de texto plano con la mención.
  // Si no, usamos el fallback con el HTML directo en el cuerpo.
  var finalBody = attachmentId ? mentionText : report.body;
  var attachmentIds = attachmentId ? [attachmentId] : [];

  if (channelId) {
    // 1. Intentar con discuss.channel (Odoo 16+)
    try {
      var response = await fetch('/web/dataset/call_kw/discuss.channel/message_post', {
        method: 'POST',
        headers: headers,
        credentials: 'same-origin',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'discuss.channel',
            method: 'message_post',
            args: [channelId],
            kwargs: {
              body: finalBody,
              subject: report.subject,
              message_type: 'comment',
              subtype_id: false,
              attachment_ids: attachmentIds
            }
          }
        })
      });
      if (response.ok) {
        var resJson = await response.json();
        if (resJson && !resJson.error) {
          console.log('Reporte enviado exitosamente a discuss.channel.');
          return;
        } else {
          console.warn('Falla en discuss.channel:', resJson.error);
        }
      }
    } catch (err) {
      console.warn('Error al intentar enviar a discuss.channel:', err);
    }

    // 2. Intentar con mail.channel (Odoo 15 y anteriores)
    try {
      var response = await fetch('/web/dataset/call_kw/mail.channel/message_post', {
        method: 'POST',
        headers: headers,
        credentials: 'same-origin',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'mail.channel',
            method: 'message_post',
            args: [channelId],
            kwargs: {
              body: finalBody,
              subject: report.subject,
              message_type: 'comment',
              subtype_id: false,
              attachment_ids: attachmentIds
            }
          }
        })
      });
      if (response.ok) {
        var resJson = await response.json();
        if (resJson && !resJson.error) {
          console.log('Reporte enviado exitosamente a mail.channel.');
          return;
        } else {
          console.warn('Falla en mail.channel:', resJson.error);
        }
      }
    } catch (err) {
      console.warn('Error al intentar enviar a mail.channel:', err);
    }
  }

  // 3. Fallback a mail.message si falla la publicación en canales
  var response = await fetch('/web/dataset/call_kw/mail.message/create', {
    method: 'POST',
    headers: headers,
    credentials: 'same-origin',
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'mail.message',
        method: 'create',
        args: [{
          body: finalBody,
          subject: report.subject,
          message_type: 'comment',
          subtype_id: false,
          attachment_ids: attachmentIds
        }],
        kwargs: {}
      }
    })
  });

  if (!response.ok) throw new Error('No disponible');
  var jsonResponse = await response.json();
  if (jsonResponse && jsonResponse.error) throw new Error(jsonResponse.error.message || 'Error Odoo');
}

async function finishDayAndNotifyOdoo() {
  if (state.dayClosed) {
    alert('El día ya fue cerrado. Los cambios posteriores quedan reservados para los admins.');
    return;
  }

  if (!areAllPhasesComplete()) {
    var statPrep = getPhaseCompletionStats('prep_moto');
    var statAper = getPhaseCompletionStats('apertura');
    var statCie = getPhaseCompletionStats('cierre');

    var pctPrep = statPrep.total > 0 ? Math.round((statPrep.done / statPrep.total) * 100) : 0;
    var pctAper = statAper.total > 0 ? Math.round((statAper.done / statAper.total) * 100) : 0;
    var pctCie = statCie.total > 0 ? Math.round((statCie.done / statCie.total) * 100) : 0;

    var alertMsg = '⚠️ No es posible cerrar el día. Por favor completa todas las tareas al 100%:\n\n' +
                   '- Fase 1 (Prep. Moto): ' + pctPrep + '% (' + statPrep.done + '/' + statPrep.total + ')\n' +
                   '- Fase 2 (Apertura): ' + pctAper + '% (' + statAper.done + '/' + statAper.total + ')\n' +
                   '- Fase 3 (Cierre): ' + pctCie + '% (' + statCie.done + '/' + statCie.total + ')';
    alert(alertMsg);
    return;
  }

  var confirmed = confirm('¿Deseas terminar el día y enviar un reporte consolidado a Odoo?');
  if (!confirmed) return;

  var closeTimestamp = Date.now();
  var report = buildDayClosureReport(closeTimestamp);

  var updatePayload = {
    dayClosed: true,
    dayClosedBy: userSession.name,
    dayClosedAt: closeTimestamp,
    dayClosureReport: report,
    'phases/cierre/endTime': closeTimestamp
  };

  try {
    await db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha).update(updatePayload);
    state.dayClosed = true;
    state.dayClosedBy = userSession.name;
    state.dayClosedAt = closeTimestamp;
    state.dayClosureReport = report;
    if (state.phases && state.phases.cierre) {
      state.phases.cierre.endTime = closeTimestamp;
    }
    renderDayClosureControl();
    applyOperationalEditLock();

    try {
      await sendDayClosureReportToOdoo(report);
      state.dayClosedReportSentAt = Date.now();
      await db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/dayClosedReportSentAt').set(state.dayClosedReportSentAt);
      alert('✅ Día cerrado correctamente y reporte enviado a Odoo.');
    } catch (err) {
      console.warn('El cierre del día se guardó, pero no pudo enviarse a Odoo.', err);
      alert('✅ Día cerrado correctamente. El reporte se guardó y quedó listo para enviarse a Odoo.');
    }
  } catch (err) {
    console.warn('No fue posible cerrar el día.', err);
    alert('No fue posible cerrar el día en este momento.');
  }
}

function reopenDay() {
  if (!userSession.isAdmin) return;
  if (!confirm('🚨 ¿Deseas reabrir el día de hoy?\n\nEsto restablecerá el cierre para que puedas editar y volver a mandar el reporte.')) return;

  var updates = {
    dayClosed: false,
    dayClosedBy: null,
    dayClosedAt: null,
    dayClosedReportSentAt: null,
    dayClosureReport: null,
    'phases/cierre/endTime': null
  };

  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha).update(updates).then(function() {
    state.dayClosed = false;
    state.dayClosedBy = null;
    state.dayClosedAt = null;
    state.dayClosedReportSentAt = null;
    state.dayClosureReport = null;
    if (state.phases && state.phases.cierre) {
      state.phases.cierre.endTime = null;
    }
    renderDayClosureControl();
    applyOperationalEditLock();
    alert('🔓 El día ha sido reabierto.');
  }).catch(function(err) {
    console.error('Error al reabrir el día:', err);
    alert('No fue posible reabrir el día.');
  });
}

function isAdminSession(rootInfo) {
  if (!rootInfo || typeof rootInfo !== 'object') return false;
  var candidates = [
    rootInfo.is_admin,
    rootInfo.is_system,
    rootInfo.user_context && rootInfo.user_context.is_admin,
    rootInfo.user && rootInfo.user.is_admin,
    rootInfo.session_info && rootInfo.session_info.is_admin,
    rootInfo.user_context && rootInfo.user_context.uid === 1,
    rootInfo.uid === 1,
    rootInfo.uid === 7,
    rootInfo.user_id === 1,
    rootInfo.user && rootInfo.user.id === 1
  ];
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i] === true) return true;
  }
  var nameText = [rootInfo.name, rootInfo.partner_display_name, rootInfo.login, rootInfo.username, rootInfo.user && rootInfo.user.name].filter(Boolean).join(' ').toLowerCase();
  return nameText.indexOf('admin') !== -1 || nameText.indexOf('administrator') !== -1;
}

function manualNameChange(newName) {
  var cleanName = newName.trim() || 'Operador de Barra';
  userSession.name = cleanName;
  localStorage.setItem('lupari_ops_username', cleanName);
  applyUserBadge();
  saveStateToCloud();
}

function syncFromCloud() {
  var f = document.getElementById('fecha') ? document.getElementById('fecha').value : getTodayISO();
  var p = document.getElementById('punto') ? document.getElementById('punto').value : 'arboleda';
  state.fecha = f; state.punto = p;
  hasAutoFocused = false;
  if (firebaseRef) firebaseRef.off();

  firebaseRef = db.ref('lupari_ops_v3/' + p + '/' + f);
  firebaseRef.on('value', function(snapshot) {
    var cloud = snapshot.val();
    if (!state.phases) state.phases = { prep_moto:{}, apertura:{}, cierre:{} };

    if (cloud) {
      state.fecha = cloud.fecha || f; state.punto = cloud.punto || p;
      var cloudPhases = cloud.phases || {};
      ['prep_moto', 'apertura', 'cierre'].forEach(function(k) {
        if (!state.phases[k]) state.phases[k] = { startTime: null, endTime: null, startedBy: null, checks: {}, notas: {}, notes: {} };
        state.phases[k].startTime = cloudPhases[k] ? cloudPhases[k].startTime : null;
        state.phases[k].endTime = cloudPhases[k] ? cloudPhases[k].endTime : null;
        state.phases[k].startedBy = cloudPhases[k] ? (cloudPhases[k].startedBy || null) : null;
        state.phases[k].checks = cloudPhases[k] ? cloudPhases[k].checks : {};
        var phaseNotes = cloudPhases[k] ? (cloudPhases[k].notas || cloudPhases[k].notes || {}) : {};
        state.phases[k].notas = phaseNotes;
        state.phases[k].notes = phaseNotes;
      });
      state.inventoryRestocks = cloud.inventoryRestocks || {};
      state.dayClosed = !!cloud.dayClosed;
      state.dayClosedBy = cloud.dayClosedBy || null;
      state.dayClosedAt = cloud.dayClosedAt || null;
      state.dayClosedReportSentAt = cloud.dayClosedReportSentAt || null;
      state.dayClosureReport = cloud.dayClosureReport || null;
      state.structure = cloud.structure || JSON.parse(JSON.stringify(DATA));
    } else {
      resetStateObj();
    }

    if (!hasAutoFocused) {
      var targetTab = 'prep_moto';
      if (state.phases.prep_moto.endTime) {
        targetTab = 'apertura';
        if (state.phases.apertura.endTime) { targetTab = 'cierre'; }
      }
      currentTab = targetTab;
      hasAutoFocused = true;
    }

    document.querySelectorAll('.wizard-step').forEach(function(el) { el.classList.toggle('active', el.id === 'wiz-' + currentTab); });

    renderNotesLog();
    renderRestockLog();
    resetRestockForm();
    var phaseTitleEl = document.getElementById('notes-phase-title');
    if (phaseTitleEl) {
      var names = { prep_moto: 'Prep. Moto', apertura: 'Apertura', cierre: 'Cierre' };
      phaseTitleEl.textContent = names[currentTab];
    }

    renderContent(); updateProgress(); updateTimeUI(); updateWizardStatus();
  });
}

function saveStateToCloud() { if (db && state.punto && state.fecha) db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha).set(state); }

function toggleCustomRestockProductInput() {
  var selectEl = document.getElementById('restock-product-select');
  var wrapEl = document.getElementById('restock-custom-product-wrap');
  var inputEl = document.getElementById('restock-custom-product');
  if (!selectEl || !wrapEl || !inputEl) return;

  var showCustom = (selectEl.value || '').trim() === '__custom__';
  wrapEl.style.display = showCustom ? 'flex' : 'none';
  if (!showCustom) {
    inputEl.value = '';
  }
}

function resetRestockForm() {
  var selectEl = document.getElementById('restock-product-select');
  var quantityEl = document.getElementById('restock-quantity');
  var unitEl = document.getElementById('restock-unit-select');
  var commentEl = document.getElementById('restock-comment');
  var customInputEl = document.getElementById('restock-custom-product');
  if (selectEl) selectEl.value = '__custom__';
  if (quantityEl) quantityEl.value = '';
  if (unitEl) unitEl.value = 'unidad';
  if (commentEl) commentEl.value = '';
  if (customInputEl) customInputEl.value = '';
  toggleCustomRestockProductInput();
}

function populateRestockProductOptions(records) {
  var selectEl = document.getElementById('restock-product-select');
  if (!selectEl) return;

  selectEl.innerHTML = '';
  var fallbackOption = new Option('Otro', '__custom__');
  selectEl.add(fallbackOption);

  var products = [];
  if (Array.isArray(records) && records.length) {
    products = records;
  } else {
    products = fallbackRestockProducts;
  }

  products.forEach(function(product) {
    var code = product.default_code || '';
    var label = code ? (code + ' - ' + (product.name || code)) : (product.name || 'Insumo');
    var option = new Option(label, label);
    option.setAttribute('data-sku', code);
    selectEl.add(option);
  });

  toggleCustomRestockProductInput();

  if (!products.length) {
    var emptyOption = new Option('Sin insumos cargados', '');
    selectEl.add(emptyOption);
  }
}

async function loadOdooInventoryProducts() {
  var selectEl = document.getElementById('restock-product-select');
  if (!selectEl) return;

  try {
    var response = await fetch('/web/dataset/call_kw/product.product/search_read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.product',
          method: 'search_read',
          args: [],
          kwargs: {
            domain: [['default_code', 'ilike', 'INS-']],
            fields: ['id', 'name', 'default_code'],
            limit: 200
          }
        }
      })
    });

    if (!response.ok) throw new Error('No disponible');
    var jsonResponse = await response.json();
    var records = Array.isArray(jsonResponse && jsonResponse.result) ? jsonResponse.result : ((jsonResponse && jsonResponse.result && Array.isArray(jsonResponse.result.records)) ? jsonResponse.result.records : []);
    populateRestockProductOptions(records);
  } catch (err) {
    populateRestockProductOptions([]);
  }
}

function triggerPhaseStart() {
  var pData = state.phases[currentTab];
  if (pData && pData.startTime) return;

  var ready = confirm('🔔 ¿Estás listo para iniciar la auditoría de esta fase?\n\nEl cronómetro operativo empezará a correr en este momento y registrará tu firma de inicio.');
  if (!ready) return;

  var now = Date.now();
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/phases/' + currentTab + '/startTime').set(now);
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/phases/' + currentTab + '/startedBy').set(userSession.name);
}

function pausePhaseTime() {
  if (!userSession.isAdmin) return;
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/phases/' + currentTab + '/startTime').set(null);
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/phases/' + currentTab + '/startedBy').set(null);
}

function resetPhaseTime() {
  if (!userSession.isAdmin) return;
  if (!confirm('🚨 ¿Deseas restablecer de raíz los tiempos y checks de esta fase para el día de hoy?')) return;
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/phases/' + currentTab + '/startTime').set(null);
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/phases/' + currentTab + '/endTime').set(null);
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/phases/' + currentTab + '/startedBy').set(null);
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/phases/' + currentTab + '/checks').set(null);
}

function toggleCheck(id, labelText) {
  var pData = state.phases[currentTab];
  if (!canEditOperationalData()) {
    alert('El día ya fue cerrado. Solo los admins pueden seguir editando.');
    return;
  }
  if (!pData || !pData.startTime || pData.endTime) return;

  var isChecked = pData.checks && pData.checks[id] && pData.checks[id].checked;
  var updatedItem = { checked: !isChecked, user: userSession.name, timestamp: Date.now(), label: labelText };
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/phases/' + currentTab + '/checks/' + id).set(updatedItem);
}

function unlockActivePhase() {
  if (!userSession.isAdmin) return;
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/phases/' + currentTab + '/endTime').set(null);
}

function advanceWorkflow() {
  if (isSpeaking) cancelVoiceAssistant();
  if (!canEditOperationalData()) {
    alert('El día ya fue cerrado. Solo los admins pueden seguir editando.');
    return;
  }

  var pData = state.phases[currentTab] || { checks: {} }; var total = 0, done = 0;
  var activeStruct = (state.structure && state.structure[currentTab]) ? state.structure[currentTab] : DATA[currentTab];

  activeStruct.forEach(function(sec) {
    if (sec && sec.items) {
      sec.items.forEach(function(item) {
        total++;
        if (pData.checks && pData.checks[item.id] && pData.checks[item.id].checked) done++;
      });
    }
  });

  if (done < total) {
    alert('⚠️ Bloqueo de Seguridad: No puedes completar la fase hasta que todas las tareas (' + done + '/' + total + ') estén marcadas.');
    return;
  }

  var now = Date.now();
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/phases/' + currentTab + '/endTime').set(now).then(function() {
    if (currentTab === 'cierre') {
      notifyOdooAdminsAboutRestocks();
    } else if (currentTab === 'prep_moto') {
      switchTab('apertura');
    } else if (currentTab === 'apertura') {
      switchTab('cierre');
    }
  });
}

function editAdminTask(sectionId, taskId) {
  if (!userSession.isAdmin) return;
  var targetItem = null;
  state.structure[currentTab].forEach(function(sec) {
    if (sec.id === sectionId) { sec.items.forEach(function(i) { if (i.id === taskId) targetItem = i; }); }
  });
  if (!targetItem) return;
  var res = prompt('Modificar texto de la tarea operativa:', targetItem.label);
  if (res && res.trim() !== '') {
    targetItem.label = res.trim();
    db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/structure').set(state.structure);
  }
}

function deleteAdminTask(sectionId, taskId) {
  if (!userSession.isAdmin) return;
  if (!confirm('¿Deseas remover esta tarea de la estructura de hoy?')) return;
  state.structure[currentTab].forEach(function(sec) {
    if (sec.id === sectionId) { sec.items = sec.items.filter(function(i) { return i.id !== taskId; }); }
  });
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/structure').set(state.structure);
}

function addAdminTask(sectionId) {
  if (!userSession.isAdmin) return;
  var res = prompt('Escribe la descripción de la nueva tarea operativa:');
  if (!res || res.trim() === '') return;
  state.structure[currentTab].forEach(function(sec) {
    if (sec.id === sectionId) {
      var uniqueId = 'tsk_' + Date.now();
      sec.items.push({ id: uniqueId, label: res.trim() });
    }
  });
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/structure').set(state.structure);
}

function addAdminCategory() {
  if (!userSession.isAdmin) return;
  var res = prompt('Escribe el título para la nueva Sección / Categoría:');
  if (!res || res.trim() === '') return;
  if (!state.structure[currentTab]) state.structure[currentTab] = [];
  var cleanId = 'sec_' + Date.now();
  state.structure[currentTab].push({ id: cleanId, title: res.trim(), items: [] });
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/structure').set(state.structure);
}

function editAdminCategory(sectionId) {
  if (!userSession.isAdmin) return;
  var targetSec = state.structure[currentTab].find(function(s) { return s.id === sectionId; });
  if (!targetSec) return;
  var res = prompt('Modificar el nombre de la Categoría:', targetSec.title);
  if (res && res.trim() !== '') {
    targetSec.title = res.trim();
    db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/structure').set(state.structure);
  }
}

function deleteAdminCategory(sectionId) {
  if (!userSession.isAdmin) return;
  if (!confirm('🚨 ¡ADVERTENCIA CRÍTICA!\n\n¿Estás seguro de eliminar esta sección completa con todas sus tareas hijas asociadas?')) return;
  state.structure[currentTab] = state.structure[currentTab].filter(function(s) { return s.id !== sectionId; });
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/structure').set(state.structure);
}

function switchTab(tab) {
  if (isSpeaking) cancelVoiceAssistant();
  currentTab = tab;
  document.querySelectorAll('.wizard-step').forEach(function(el) { el.classList.toggle('active', el.id === 'wiz-' + currentTab); });
  if (document.getElementById('search-input')) document.getElementById('search-input').value = '';

  renderContent(); updateProgress(); updateTimeUI(); renderNotesLog();

  var phaseTitleEl = document.getElementById('notes-phase-title');
  if (phaseTitleEl) {
    var names = { prep_moto: 'Prep. Moto', apertura: 'Apertura', cierre: 'Cierre' };
    phaseTitleEl.textContent = names[tab] || tab;
  }
}

function filterChecklist() { renderContent(); }

function renderNotesLog() {
  var container = document.getElementById('notes-log-container'); if (!container) return;
  container.innerHTML = '';
  var currentPhaseData = state.phases[currentTab];
  var notasObj = currentPhaseData ? (currentPhaseData.notas || currentPhaseData.notes || null) : null;

  if (!notasObj || Object.keys(notasObj).length === 0) {
    container.innerHTML = '<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:12px;">No hay novedades para esta fase.</div>';
    return;
  }
  var list = []; for (var key in notasObj) { list.push(Object.assign({ _key: key }, notasObj[key])); }
  list.sort(function(a, b) { return a.timestamp - b.timestamp; });
  list.forEach(function(note) {
    var entry = document.createElement('div'); entry.className = 'note-entry';
    var actionsHtml = '';
    if (canEditEntry(note)) {
      actionsHtml = '<div class="restock-actions"><button onclick="editPhaseNote(\'' + note._key + '\')">Editar</button><button onclick="deletePhaseNote(\'' + note._key + '\')">Eliminar</button></div>';
    }
    entry.innerHTML = '<div class="note-meta"><span class="note-user">✏️ ' + escapeHtml(note.user || 'Sin usuario') + '</span><span class="note-time">' + formatTime(note.timestamp) + '</span></div><div class="note-text">' + escapeHtml(note.text || '') + '</div>' + actionsHtml;
    container.appendChild(entry);
  });
  container.scrollTop = container.scrollHeight;
}

function addPhaseNote() {
  if (!canEditOperationalData()) {
    alert('El día ya fue cerrado. Solo los admins pueden seguir editando.');
    return;
  }
  var inputEl = document.getElementById('notes-input'); if (!inputEl) return;
  var txt = inputEl.value.trim(); if (!txt) return;
  var noteData = { user: userSession.name, text: txt, timestamp: Date.now() };
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/phases/' + currentTab + '/notas').push(noteData).then(function() {
    inputEl.value = '';
  });
}

function editPhaseNote(key) {
  if (!canEditOperationalData()) {
    alert('El día ya fue cerrado. Solo los admins pueden seguir editando.');
    return;
  }
  var currentPhaseData = state.phases[currentTab] || {};
  var note = currentPhaseData.notas && currentPhaseData.notas[key] ? currentPhaseData.notas[key] : null;
  if (!note || !canEditEntry(note)) { alert('No tienes permisos para editar esta incidencia.'); return; }
  var newText = prompt('Edita tu incidencia:', note.text || '');
  if (newText === null) return;
  var cleanText = newText.trim(); if (!cleanText) return;
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/phases/' + currentTab + '/notas/' + key + '/text').set(cleanText);
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/phases/' + currentTab + '/notas/' + key + '/timestamp').set(Date.now());
}

function deletePhaseNote(key) {
  if (!canEditOperationalData()) {
    alert('El día ya fue cerrado. Solo los admins pueden seguir editando.');
    return;
  }
  var currentPhaseData = state.phases[currentTab] || {};
  var note = currentPhaseData.notas && currentPhaseData.notas[key] ? currentPhaseData.notas[key] : null;
  if (!note || !canEditEntry(note)) { alert('No tienes permisos para eliminar esta incidencia.'); return; }
  if (!confirm('¿Deseas borrar esta incidencia?')) return;
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/phases/' + currentTab + '/notas/' + key).remove();
}

function renderRestockLog() {
  var container = document.getElementById('restock-log-container'); if (!container) return;
  container.innerHTML = '';
  var entries = [];
  for (var key in state.inventoryRestocks || {}) {
    entries.push(Object.assign({ _key: key }, state.inventoryRestocks[key]));
  }
  entries.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

  if (!entries.length) {
    container.innerHTML = '<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">No hay reabastecimientos reportados.</div>';
    return;
  }

  entries.forEach(function(entry) {
    var item = document.createElement('div'); item.className = 'restock-entry';
    var actionsHtml = '';
    if (canEditEntry(entry)) {
      actionsHtml = '<div class="restock-actions"><button onclick="editInventoryRestockEntry(\'' + entry._key + '\')">Editar</button><button onclick="deleteInventoryRestockEntry(\'' + entry._key + '\')">Eliminar</button></div>';
    }
    item.innerHTML = '<div class="restock-meta"><span>' + escapeHtml(entry.user || 'Sin usuario') + '</span><span>' + formatTime(entry.timestamp) + '</span></div><div class="restock-line"><strong>' + escapeHtml(entry.product || 'Sin producto') + '</strong> · ' + escapeHtml(entry.quantity || '0') + ' ' + escapeHtml(entry.unit || '') + '</div>' + (entry.comment ? '<div class="restock-line" style="margin-top:4px; color:var(--text-muted);">' + escapeHtml(entry.comment) + '</div>' : '') + actionsHtml;
    container.appendChild(item);
  });
}

function addInventoryRestock() {
  if (!canEditOperationalData()) {
    alert('El día ya fue cerrado. Solo los admins pueden seguir editando.');
    return;
  }
  var productSelect = document.getElementById('restock-product-select');
  var quantityEl = document.getElementById('restock-quantity');
  var unitEl = document.getElementById('restock-unit-select');
  var commentEl = document.getElementById('restock-comment');
  if (!productSelect || !quantityEl || !unitEl || !commentEl) return;

  var selected = (productSelect.value || '').trim();
  var productName = selected;
  if (!productName || selected === '__custom__') {
    var customInputEl = document.getElementById('restock-custom-product');
    var customValue = customInputEl ? customInputEl.value.trim() : '';
    if (!customValue) {
      alert('Escribe el nombre del insumo cuando eliges "Otro".');
      return;
    }
    productName = customValue;
  }

  var quantity = parseFloat(quantityEl.value);
  if (isNaN(quantity) || quantity <= 0) {
    alert('Registra una cantidad válida para el reabastecimiento.');
    return;
  }

  var unit = (unitEl.value || 'unidad').trim();
  if (!unit) {
    alert('Selecciona una unidad para el reabastecimiento.');
    return;
  }

  var comment = commentEl.value.trim();
  var entryData = {
    user: userSession.name,
    product: productName.trim(),
    quantity: quantity,
    unit: unit,
    comment: comment,
    timestamp: Date.now()
  };

  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/inventoryRestocks').push(entryData).then(function() {
    resetRestockForm();
    renderRestockLog();
  });
}

function editInventoryRestockEntry(key) {
  if (!canEditOperationalData()) {
    alert('El día ya fue cerrado. Solo los admins pueden seguir editando.');
    return;
  }
  var entry = state.inventoryRestocks && state.inventoryRestocks[key] ? state.inventoryRestocks[key] : null;
  if (!entry || !canEditEntry(entry)) { alert('No tienes permisos para editar este reabastecimiento.'); return; }

  var productName = prompt('Producto reportado:', entry.product || '');
  if (productName === null) return;
  var quantityValue = prompt('Cantidad:', entry.quantity || '');
  if (quantityValue === null) return;
  var quantity = parseFloat(quantityValue);
  if (isNaN(quantity) || quantity <= 0) { alert('La cantidad debe ser mayor a cero.'); return; }
  var unit = prompt('Unidad (g, kg, ml, L, unidad):', entry.unit || 'unidad');
  if (unit === null) return;
  var comment = prompt('Comentario:', entry.comment || '');
  if (comment === null) return;

  var updatedEntry = Object.assign({}, entry, {
    product: productName.trim(),
    quantity: quantity,
    unit: (unit || 'unidad').trim(),
    comment: comment.trim(),
    editedAt: Date.now(),
    editedBy: userSession.name
  });
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/inventoryRestocks/' + key).update(updatedEntry);
}

function deleteInventoryRestockEntry(key) {
  if (!canEditOperationalData()) {
    alert('El día ya fue cerrado. Solo los admins pueden seguir editando.');
    return;
  }
  var entry = state.inventoryRestocks && state.inventoryRestocks[key] ? state.inventoryRestocks[key] : null;
  if (!entry || !canEditEntry(entry)) { alert('No tienes permisos para eliminar este reabastecimiento.'); return; }
  if (!confirm('¿Deseas borrar este reporte de reabastecimiento?')) return;
  db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/inventoryRestocks/' + key).remove();
}

async function notifyOdooAdminsAboutRestocks() {
  var restocks = state.inventoryRestocks || {};
  var entries = Object.keys(restocks).map(function(key) { return Object.assign({ _key: key }, restocks[key]); }).sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
  if (!entries.length) return;

  var lines = entries.map(function(entry) {
    return '- ' + (entry.product || 'Sin producto') + ': ' + (entry.quantity || 0) + ' ' + (entry.unit || 'unidad') + (entry.comment ? ' | ' + entry.comment : '');
  });
  var message = 'Lupari Ops - Reabastecimiento reportado al cierre de la fase 3:\n' + lines.join('\n');

  try {
    await fetch('/web/dataset/call_kw/mail.message/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'mail.message',
          method: 'create',
          args: [{
            body: message,
            subject: 'Reabastecimiento Lupari Ops',
            message_type: 'comment',
            subtype_id: false
          }],
          kwargs: {}
        }
      })
    });
  } catch (err) {
    console.warn('No fue posible notificar a Odoo automáticamente.', err);
  }
}

function toggleCategoryVoice(sectionId) {
  if (!('speechSynthesis' in window)) { alert('⚠️ Tu dispositivo no soporta comandos de voz.'); return; }
  var btnId = 'v-btn-' + sectionId;
  if (isSpeaking && currentSpeakingBtnId === btnId) { cancelVoiceAssistant(); return; }
  if (isSpeaking) { cancelVoiceAssistant(); }

  var pData = state.phases[currentTab] || { checks: {} };
  var activeStruct = (state.structure && state.structure[currentTab]) ? state.structure[currentTab] : DATA[currentTab];
  var targetSection = activeStruct.find(function(s) { return s.id === sectionId; });
  if (!targetSection) return;

  var pendingItems = [];
  targetSection.items.forEach(function(item) {
    var isChecked = pData.checks && pData.checks[item.id] && pData.checks[item.id].checked;
    if (!isChecked) pendingItems.push(item.label);
  });

  if (pendingItems.length === 0) {
    speakText('Sección completada. No hay tareas pendientes en ' + targetSection.title, btnId); return;
  }

  isSpeaking = true; currentSpeakingBtnId = btnId;
  var activeBtn = document.getElementById(btnId); if (activeBtn) { activeBtn.textContent = '⏹️ Detener'; activeBtn.classList.add('playing'); }

  var script = 'Pendientes en: ' + targetSection.title + '. ';
  pendingItems.forEach(function(text, idx) { script += 'Número ' + (idx + 1) + ': ' + text + '.      ...      '; });
  speakText(script, btnId);
}

function speakText(textString, btnId) {
  window.speechSynthesis.cancel();
  speechUtterance = new SpeechSynthesisUtterance(textString);
  var voices = window.speechSynthesis.getVoices();
  var mxVoice = voices.find(function(v) { return (v.name.includes('Marisol') || v.name.includes('Siri') || v.name.includes('Sabina') || v.name.includes('Mexico')) && v.lang === 'es-MX'; }) ||
                voices.find(function(v) { return v.lang === 'es-MX'; }) || voices.find(function(v) { return v.lang.startsWith('es'); });
  if (mxVoice) speechUtterance.voice = mxVoice;
  speechUtterance.lang = 'es-MX'; speechUtterance.rate = 0.92; speechUtterance.pitch = 1.0;
  speechUtterance.onend = function() { cancelVoiceAssistant(); };
  speechUtterance.onerror = function() { cancelVoiceAssistant(); };
  window.speechSynthesis.speak(speechUtterance);
}

function cancelVoiceAssistant() {
  isSpeaking = false; window.speechSynthesis.cancel();
  if (currentSpeakingBtnId) {
    var oldBtn = document.getElementById(currentSpeakingBtnId);
    if (oldBtn) { oldBtn.textContent = '🎙️ Asistente'; oldBtn.classList.remove('playing'); }
  }
  currentSpeakingBtnId = null;
}

if ('speechSynthesis' in window) { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = function() { window.speechSynthesis.getVoices(); }; }

function cleanOdooWrapperLayout() {
  try {
    var pivot = document.querySelector('#lupari-root-node'); if (!pivot) return;
    var embeddedBox = pivot.closest('.s_embed_code_embedded');
    if (embeddedBox) {
      embeddedBox.style.setProperty('background-color', '#09090b', 'important');
      embeddedBox.style.setProperty('padding', '0', 'important');
      embeddedBox.style.setProperty('max-width', '100%', 'important');
      embeddedBox.style.setProperty('width', '100%', 'important');
    }
    var embedSection = pivot.closest('section.s_embed_code');
    if (embedSection) {
      embedSection.style.setProperty('background-color', '#09090b', 'important');
      embedSection.style.setProperty('padding-top', '0', 'important');
      embedSection.style.setProperty('padding-bottom', '0', 'important');
      embedSection.style.setProperty('padding-left', '0', 'important');
      embedSection.style.setProperty('padding-right', '0', 'important');
      embedSection.style.setProperty('margin', '0', 'important');
      embedSection.style.setProperty('max-width', '100%', 'important');
      embedSection.style.setProperty('width', '100%', 'important');
    }
  } catch (err) { console.warn('Layout lock.'); }
}

window.switchTab = switchTab;
window.triggerPhaseStart = triggerPhaseStart;
window.pausePhaseTime = pausePhaseTime;
window.resetPhaseTime = resetPhaseTime;
window.toggleCheck = toggleCheck;
window.unlockActivePhase = unlockActivePhase;
window.advanceWorkflow = advanceWorkflow;
window.editAdminTask = editAdminTask;
window.deleteAdminTask = deleteAdminTask;
window.addAdminTask = addAdminTask;
window.addAdminCategory = addAdminCategory;
window.editAdminCategory = editAdminCategory;
window.deleteAdminCategory = deleteAdminCategory;
window.filterChecklist = filterChecklist;
window.addPhaseNote = addPhaseNote;
window.editPhaseNote = editPhaseNote;
window.deletePhaseNote = deletePhaseNote;
window.addInventoryRestock = addInventoryRestock;
window.editInventoryRestockEntry = editInventoryRestockEntry;
window.deleteInventoryRestockEntry = deleteInventoryRestockEntry;
window.toggleCategoryVoice = toggleCategoryVoice;
window.toggleSectionCollapse = toggleSectionCollapse;
window.manualNameChange = manualNameChange;
window.triggerMobilePrint = triggerMobilePrint;
window.detectOdooUser = detectOdooUser;
window.renderContent = renderContent;
window.renderNotesLog = renderNotesLog;
window.renderRestockLog = renderRestockLog;
window.loadOdooInventoryProducts = loadOdooInventoryProducts;
window.toggleCustomRestockProductInput = toggleCustomRestockProductInput;
window.finishDayAndNotifyOdoo = finishDayAndNotifyOdoo;
window.reopenDay = reopenDay;

function resetStateObj() {
  state.fecha = document.getElementById('fecha') ? document.getElementById('fecha').value : getTodayISO();
  state.punto = document.getElementById('punto') ? document.getElementById('punto').value : 'arboleda';
  state.phases = {
    prep_moto: { startTime: null, endTime: null, startedBy: null, checks: {}, notas: {}, notes: {} },
    apertura: { startTime: null, endTime: null, startedBy: null, checks: {}, notas: {}, notes: {} },
    cierre: { startTime: null, endTime: null, startedBy: null, checks: {}, notas: {}, notes: {} }
  };
  state.inventoryRestocks = {};
  state.dayClosed = false;
  state.dayClosedBy = null;
  state.dayClosedAt = null;
  state.dayClosedReportSentAt = null;
  state.dayClosureReport = null;
  state.structure = JSON.parse(JSON.stringify(DATA));
  var container = document.getElementById('notes-log-container'); if (container) container.innerHTML = '';
  var restockContainer = document.getElementById('restock-log-container'); if (restockContainer) restockContainer.innerHTML = '';
  if (db) db.ref('lupari_ops_v3/' + state.punto + '/' + state.fecha + '/structure').set(state.structure);
}

function initializeApp() {
  cleanOdooWrapperLayout(); detectOdooUser();
  var fechaEl = document.getElementById('fecha'); var puntoEl = document.getElementById('punto');
  if (fechaEl && !state.fecha) state.fecha = getTodayISO();
  if (fechaEl) fechaEl.value = state.fecha; if (puntoEl) puntoEl.value = state.punto;

  syncFromCloud();
  loadOdooInventoryProducts();
  window.setTimeout(loadOdooInventoryProducts, 1500);

  if (fechaEl) fechaEl.addEventListener('change', function() { syncFromCloud(); });
  if (puntoEl) puntoEl.addEventListener('change', function() { syncFromCloud(); });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

setInterval(cleanOdooWrapperLayout, 2000);
setInterval(function() { if (state.phases && state.phases[currentTab] && state.phases[currentTab].startTime && !state.phases[currentTab].endTime) { updateTimeUI(); } }, 15000);
