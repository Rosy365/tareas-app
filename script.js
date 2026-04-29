// configuration de la base de datos
const dbName = "TareasDB";
let db;

// Inicializar IndexedDB
const request = indexedDB.open(dbName, 1);

request.onupgradeneeded = (e) => {
  db = e.target.result;
  if (!db.objectStoreNames.contains("tasks")) {
    db.createObjectStore("tasks", { keyPath: "id", autoIncrement: true });
  }
};

request.onsuccess = (e) => {
  db = e.target.result;
  loadTasksFromDB(); // Cargar tareas al iniciar
};

let tasks = [];
let editIndex = null;
let currentFilter = 'all';
let searchQuery = '';

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

// --- FUNCIONES DE PERSISTENCIA ---

function loadTasksFromDB() {
  const transaction = db.transaction(["tasks"], "readonly");
  const store = transaction.objectStore("tasks");
  const getAll = store.getAll();

  getAll.onsuccess = () => {
    tasks = getAll.result;
    renderStats();
    renderTasks();
    renderCalendar();
  };
}

function saveTaskToDB(task, callback) {
  const transaction = db.transaction(["tasks"], "readwrite");
  const store = transaction.objectStore("tasks");
  const request = store.add(task);
  request.onsuccess = () => {
    loadTasksFromDB();
    if (callback) callback();
  };
}

function updateTaskInDB(task) {
  const transaction = db.transaction(["tasks"], "readwrite");
  const store = transaction.objectStore("tasks");
  store.put(task);
  transaction.oncomplete = () => loadTasksFromDB();
}

function deleteTaskFromDB(id) {
  const transaction = db.transaction(["tasks"], "readwrite");
  const store = transaction.objectStore("tasks");
  store.delete(id);
  transaction.oncomplete = () => loadTasksFromDB();
}

// --- LÓGICA DE LA INTERFAZ ---

function toggleDarkMode() {
  const body = document.body;
  const btn = document.getElementById('themeToggle');
  body.classList.toggle('dark');
  btn.innerHTML = body.classList.contains('dark') ? '☀️' : '🌙';
}

function addTask() {
  const titleInput = document.getElementById('title');
  const descInput = document.getElementById('desc');
  const dateInput = document.getElementById('date');
  const importantInput = document.getElementById('important');
  const fileInput = document.getElementById('file');

  if (!titleInput.value.trim()) {
    titleInput.style.borderColor = "red";
    setTimeout(() => titleInput.style.borderColor = "", 2000);
    return;
  }

  const file = fileInput.files[0];
  const newTask = {
    title: titleInput.value,
    desc: descInput.value,
    date: dateInput.value,
    important: importantInput.checked,
    completed: false,
    fileData: null,
    fileName: file ? file.name : null
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      newTask.fileData = e.target.result; // Aquí se guarda el archivo pesado
      saveTaskToDB(newTask, () => {
          titleInput.value = ''; descInput.value = ''; dateInput.value = '';
          importantInput.checked = false; fileInput.value = '';
      });
    };
    reader.readAsDataURL(file);
  } else {
    saveTaskToDB(newTask, () => {
        titleInput.value = ''; descInput.value = ''; dateInput.value = '';
        importantInput.checked = false; fileInput.value = '';
    });
  }
}

function renderTasks() {
  const container = document.getElementById('tasks');
  container.innerHTML = '';
  const today = new Date().toISOString().split('T')[0];

  let filtered = [...tasks];

  if (currentFilter === 'pending') filtered = tasks.filter(t => !t.completed);
  if (currentFilter === 'important') filtered = tasks.filter(t => t.important && !t.completed);
  if (currentFilter === 'completed') filtered = tasks.filter(t => t.completed);
  if (currentFilter === 'normal') filtered = tasks.filter(t => !t.important && !t.completed); // Agregar esta línea

  if (searchQuery) {
    filtered = filtered.filter(t => t.title.toLowerCase().includes(searchQuery));
  }

  filtered.forEach((task) => {
    const div = document.createElement('div');
    const isOverdue = task.date && task.date < today && !task.completed;
    
    div.className = `card ${task.important ? 'priority-important' : ''} ${task.completed ? 'task-done' : ''} ${isOverdue ? 'overdue' : ''}`;
    
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between;">
        <strong>${task.title}</strong>
        ${task.important ? '⭐' : ''}
      </div>
      <p style="margin:5px 0; font-size:0.9em;">${task.desc || ''}</p>
      <small class="date">${task.date || 'Sin fecha'}</small>
      ${task.fileData ? `<span class="file-link" onclick="openFile(${task.id})">📎 Ver: ${task.fileName || 'Archivo'}</span>` : ''}
      <div class="actions">
        <button class="btn-complete" onclick="toggleComplete(${task.id})">${task.completed ? '↩️' : '✅'}</button>
        <button class="btn-delete" onclick="deleteTask(${task.id})">🗑️</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function openFile(id) {
  const task = tasks.find(t => t.id === id);
  if (!task || !task.fileData) return;

  const newWindow = window.open();
  if (newWindow) {
    // Detectar si es imagen para mostrarla directamente
    if (task.fileData.startsWith("data:image")) {
        newWindow.document.write(`<img src="${task.fileData}" style="max-width:100%;">`);
    } else {
        newWindow.location.href = task.fileData;
    }
  }
}

function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    updateTaskInDB(task);
  }
}

function deleteTask(id) {
  if (confirm("¿Eliminar tarea?")) {
    deleteTaskFromDB(id);
  }
}

// --- ESTADÍSTICAS Y CALENDARIO (Simplificados) ---

function renderStats(){
  const container = document.getElementById('stats');
  if(!container) return; // Seguridad

  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  const today = new Date();
  const overdue = tasks.filter(t => t.date && new Date(t.date) < today && !t.completed).length;

  container.innerHTML = `
    <div style="line-height: 1.6;">
      <strong>📊 Estadísticas</strong><br>
      <div style="background: #eee; border-radius: 5px; height: 10px; margin: 5px 0;">
        <div style="background: #4CAF50; width: ${percent}%; height: 100%; border-radius: 5px; transition: width 0.5s;"></div>
      </div>
      Total: <b>${total}</b> | Completadas: <b>${completed}</b><br>
      Pendientes: <b>${pending}</b> | 🚨 Vencidas: <b style="color: #e53935;">${overdue}</b>
    </div>
  `;
}

function updateSearch() {
  searchQuery = document.getElementById('searchBar').value.toLowerCase();
  renderTasks();
}

function filterTasks(type, btn) {
  currentFilter = type;
  document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTasks();
}

// (Las funciones de calendario se mantienen similares, llamando a loadTasksFromDB)
// --- CALENDARIO Y MODALES ---

function renderCalendar() {
  const calendar = document.getElementById('calendar');
  const label = document.getElementById('monthLabel');
  if (!calendar || !label) return;
  calendar.innerHTML = '';

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  // Ajuste para que empiece en lunes (opcional)
  const startingDay = firstDay === 0 ? 6 : firstDay - 0; 
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  label.textContent = `${monthNames[currentMonth]} ${currentYear}`;

  const daysHeader = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  let html = '<div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:5px; text-align:center;">';
  
  daysHeader.forEach(day => {
    html += `<div style="font-weight:bold; font-size:0.8em; padding-bottom:5px;">${day}</div>`;
  });

  for (let i = 0; i < startingDay; i++) html += '<div></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    // Filtramos del array global 'tasks' que ya cargó IndexedDB
    const dayTasks = tasks.filter(t => t.date === dateStr);
    const count = dayTasks.length;
    const isToday = new Date().toISOString().split('T')[0] === dateStr;

    html += `
      <div style="padding:8px 2px; border-radius:8px; background:${isToday ? '#4cadfc' : '#eee'}; 
           color:${isToday ? 'white' : 'black'}; text-align:center; cursor:pointer; font-size:0.9em;" 
           onclick="showDayTasks('${dateStr}')">
        ${d}${count > 0 ? `<br><b style="font-size:0.7em;">• ${count}</b>` : ''}
      </div>`;
  }

  html += '</div>';
  calendar.innerHTML = html;
}

function prevMonth() {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
}

function nextMonth() {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
}

function showDayTasks(date) {
  const list = document.getElementById('dayTasks');
  const title = document.getElementById('dayTitle');
  const modal = document.getElementById('dayModal');

  const dayTasks = tasks.filter(t => t.date === date);
  title.textContent = "Tareas para " + date;

  if (dayTasks.length === 0) {
    list.innerHTML = "<p>No hay tareas este día</p>";
  } else {
    // Usamos t.id porque es la llave única de IndexedDB
    list.innerHTML = dayTasks.map(t =>
      `<div class="link-task" onclick="goToTask(${t.id})" style="cursor:pointer; color:#42a8fb; margin-bottom:10px;">
        • ${t.title} ${t.completed ? '✅' : ''}
      </div>`
    ).join('');
  }

  modal.style.display = 'flex';
}

function goToTask(id) {
  closeDayModal();
  // Esperamos un momento a que el modal cierre para hacer el scroll
  setTimeout(() => {
    // Buscamos el elemento por el ID generado en renderTasks
    // Nota: en renderTasks añadimos el ID al elemento, asegúrate que diga div.id = 'task-' + task.id;
    const el = document.querySelector(`[onclick*="toggleComplete(${id})"]`)?.closest('.card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.boxShadow = "0 0 15px #4cadfc";
      setTimeout(() => el.style.boxShadow = "", 2000);
    }
  }, 300);
}

function closeDayModal() { 
  document.getElementById('dayModal').style.display = 'none'; 
}

// Registrar el Service Worker (PWA)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(err => console.log("SW error:", err));
}

document.addEventListener('DOMContentLoaded', () => {
    renderCalendar();
});