const STORAGE_KEYS = {
  clients: "tvClientManager.clients",
  servers: "tvClientManager.servers",
};

const state = {
  clients: readStorage(STORAGE_KEYS.clients, []),
  servers: readStorage(STORAGE_KEYS.servers, []),
  route: "dashboard",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const today = startOfDay(new Date());

document.addEventListener("DOMContentLoaded", () => {
  bindNavigation();
  bindClientForm();
  bindServerForm();
  bindGlobalActions();
  renderAll();
});

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage() {
  localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(state.clients));
  localStorage.setItem(STORAGE_KEYS.servers, JSON.stringify(state.servers));
}

function bindNavigation() {
  $$(".nav-link").forEach((button) => {
    button.addEventListener("click", () => setRoute(button.dataset.route));
  });

  $("#toggleSidebar").addEventListener("click", () => {
    $("#sidebar").classList.toggle("collapsed");
  });

  $("#mobileMenu").addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
  });
}

function bindGlobalActions() {
  $("#seedDataBtn").addEventListener("click", seedExampleData);
  $("#clearDataBtn").addEventListener("click", () => {
    if (!confirm("Remover todos os clientes e servidores?")) return;
    state.clients = [];
    state.servers = [];
    writeStorage();
    resetClientForm();
    resetServerForm();
    renderAll();
    showToast("Dados removidos.");
  });
}

function setRoute(route) {
  state.route = route;
  $$(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.route === route));
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === `${route}View`));
  const activeView = $(`#${route}View`);
  $("#pageTitle").textContent = activeView?.dataset.title ?? "Dashboard";
  $("#sidebar").classList.remove("open");
  renderAll();
}

function bindClientForm() {
  $("#clientForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const id = $("#clientId").value || crypto.randomUUID();
    const payload = {
      id,
      name: $("#clientName").value.trim(),
      phone: $("#clientPhone").value.trim(),
      serverId: $("#clientServer").value,
      app: $("#clientApp").value.trim(),
      login: $("#clientLogin").value.trim(),
      password: $("#clientPassword").value.trim(),
      planValue: Number($("#clientPlanValue").value || 0),
      status: $("#clientStatus").value,
      paymentDate: $("#clientPaymentDate").value,
      internalDueDate: $("#clientInternalDueDate").value,
    };

    const existingIndex = state.clients.findIndex((client) => client.id === id);
    if (existingIndex >= 0) {
      state.clients[existingIndex] = payload;
      showToast("Cliente atualizado.");
    } else {
      state.clients.push(payload);
      showToast("Cliente cadastrado.");
    }

    writeStorage();
    resetClientForm();
    renderAll();
  });

  $("#cancelClientEdit").addEventListener("click", resetClientForm);
  ["clientSearch", "clientStatusFilter", "clientSort"].forEach((id) => {
    $(`#${id}`).addEventListener("input", renderClients);
  });
}

function bindServerForm() {
  $("#serverForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const id = $("#serverId").value || crypto.randomUUID();
    const payload = {
      id,
      name: $("#serverName").value.trim(),
      url: $("#serverUrl").value.trim(),
      notes: $("#serverNotes").value.trim(),
    };

    const existingIndex = state.servers.findIndex((server) => server.id === id);
    if (existingIndex >= 0) {
      state.servers[existingIndex] = payload;
      showToast("Servidor atualizado.");
    } else {
      state.servers.push(payload);
      showToast("Servidor cadastrado.");
    }

    writeStorage();
    resetServerForm();
    renderAll();
  });

  $("#cancelServerEdit").addEventListener("click", resetServerForm);
}

function renderAll() {
  renderServerOptions();
  renderDashboard();
  renderClients();
  renderServers();
  renderBilling();
}

function renderServerOptions() {
  const select = $("#clientServer");
  const currentValue = select.value;
  select.innerHTML = [
    `<option value="">Selecione</option>`,
    ...state.servers.map((server) => `<option value="${server.id}">${escapeHtml(server.name)}</option>`),
  ].join("");
  select.value = currentValue;
}

function renderDashboard() {
  const paidThisMonth = state.clients.filter((client) => {
    const date = parseDate(client.paymentDate);
    return client.status === "Pago" && date && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  }).length;

  const cards = [
    { label: "Ativos", value: countByStatus("Ativo"), icon: "fa-user-check" },
    { label: "Vencidos interno", value: getInternalExpired().length, icon: "fa-triangle-exclamation" },
    { label: "Perto de vencer", value: getInternalAlerts(7).length, icon: "fa-calendar-check" },
    { label: "Cobrancas proximas", value: getBillingAlerts().length, icon: "fa-message" },
    { label: "Pagos no mes", value: paidThisMonth, icon: "fa-circle-dollar-to-slot" },
  ];

  $("#summaryCards").innerHTML = cards.map((card) => `
    <article class="summary-card">
      <i class="fa-solid ${card.icon}"></i>
      <span>${card.label}</span>
      <strong>${card.value}</strong>
    </article>
  `).join("");

  renderAlertRows("#dashboardBillingAlerts", getBillingAlerts(), "paymentDate");
  renderAlertRows("#dashboardInternalAlerts", getInternalAlerts(7), "internalDueDate");
}

function renderAlertRows(target, clients, dateField) {
  const tbody = $(target);
  if (!clients.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty">Nenhum alerta no periodo.</td></tr>`;
    return;
  }

  tbody.innerHTML = clients.map((client) => {
    const days = daysUntil(client[dateField]);
    const badgeClass = days < 0 ? "overdue" : days <= 2 ? "soon" : "neutral";
    return `
      <tr class="${days < 0 ? "overdue-row" : "urgent-row"}">
        <td>${escapeHtml(client.name)}</td>
        <td>${formatDate(client[dateField])}</td>
        <td><span class="badge ${badgeClass}">${daysLabel(days)}</span></td>
      </tr>
    `;
  }).join("");
}

function renderClients() {
  const query = $("#clientSearch").value.trim().toLowerCase();
  const status = $("#clientStatusFilter").value;
  const sort = $("#clientSort").value;
  const rows = state.clients
    .filter((client) => !status || client.status === status)
    .filter((client) => [client.name, client.phone, client.login, client.app].some((value) => String(value ?? "").toLowerCase().includes(query)))
    .sort((a, b) => String(a[sort] ?? "").localeCompare(String(b[sort] ?? ""), "pt-BR"));

  const tbody = $("#clientsTable");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Nenhum cliente encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((client) => {
    const paymentDays = daysUntil(client.paymentDate);
    const internalDays = daysUntil(client.internalDueDate);
    const rowClass = internalDays < 0 || paymentDays < 0 ? "overdue-row" : internalDays <= 7 || paymentDays <= 3 ? "urgent-row" : "";
    return `
      <tr class="${rowClass}">
        <td>
          <div class="client-main">
            <strong>${escapeHtml(client.name)}</strong>
            <span>${escapeHtml(client.phone || "Sem telefone")} | ${escapeHtml(client.login || "Sem login")}</span>
          </div>
        </td>
        <td>${escapeHtml(getServerName(client.serverId))}</td>
        <td>${formatMoney(client.planValue)}</td>
        <td>${formatDate(client.paymentDate)}<br><span class="badge ${paymentDays < 0 ? "overdue" : paymentDays <= 3 ? "soon" : "neutral"}">${daysLabel(paymentDays)}</span></td>
        <td>${formatDate(client.internalDueDate)}<br><span class="badge ${internalDays < 0 ? "overdue" : internalDays <= 7 ? "soon" : "neutral"}">${daysLabel(internalDays)}</span></td>
        <td><span class="badge ${client.status}">${client.status}</span></td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" type="button" title="Editar" onclick="editClient('${client.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="icon-btn danger" type="button" title="Excluir" onclick="deleteClient('${client.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderServers() {
  const list = $("#serversList");
  if (!state.servers.length) {
    list.innerHTML = `<div class="empty">Nenhum servidor cadastrado.</div>`;
    return;
  }

  list.innerHTML = state.servers.map((server) => `
    <article class="server-card">
      <header>
        <div>
          <h3>${escapeHtml(server.name)}</h3>
          <p>${escapeHtml(server.url || "Sem URL informada")}</p>
        </div>
        <div class="row-actions">
          <button class="icon-btn" type="button" title="Editar" onclick="editServer('${server.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn danger" type="button" title="Excluir" onclick="deleteServer('${server.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </header>
      <p>${escapeHtml(server.notes || "Sem observacoes.")}</p>
    </article>
  `).join("");
}

function renderBilling() {
  const list = $("#billingList");
  const alerts = getBillingAlerts();
  if (!alerts.length) {
    list.innerHTML = `<div class="empty">Nenhuma cobranca vence nos proximos 3 dias.</div>`;
    return;
  }

  list.innerHTML = alerts.map((client) => {
    const message = billingMessage(client);
    const whatsappUrl = client.phone ? `https://wa.me/${onlyDigits(client.phone)}?text=${encodeURIComponent(message)}` : "";
    return `
      <article class="billing-card">
        <header>
          <div>
            <h3>${escapeHtml(client.name)}</h3>
            <p>${formatMoney(client.planValue)} | vence ${daysLabel(daysUntil(client.paymentDate)).toLowerCase()} | ${formatDate(client.paymentDate)}</p>
          </div>
          <div class="row-actions">
            <button class="secondary-btn" type="button" onclick="copyBillingMessage('${client.id}')">
              <i class="fa-solid fa-copy"></i>
              <span>Copiar</span>
            </button>
            <button class="primary-btn" type="button" onclick="openWhatsApp('${client.id}')" ${whatsappUrl ? "" : "disabled"}>
              <i class="fa-brands fa-whatsapp"></i>
              <span>WhatsApp</span>
            </button>
          </div>
        </header>
        <div class="billing-message">${escapeHtml(message)}</div>
      </article>
    `;
  }).join("");
}

function editClient(id) {
  const client = state.clients.find((item) => item.id === id);
  if (!client) return;
  $("#clientId").value = client.id;
  $("#clientName").value = client.name;
  $("#clientPhone").value = client.phone;
  $("#clientServer").value = client.serverId;
  $("#clientApp").value = client.app;
  $("#clientLogin").value = client.login;
  $("#clientPassword").value = client.password;
  $("#clientPlanValue").value = client.planValue;
  $("#clientStatus").value = client.status;
  $("#clientPaymentDate").value = client.paymentDate;
  $("#clientInternalDueDate").value = client.internalDueDate;
  $("#clientFormTitle").textContent = "Editar cliente";
  $("#cancelClientEdit").classList.remove("hidden");
  setRoute("clients");
}

function deleteClient(id) {
  const client = state.clients.find((item) => item.id === id);
  if (!client || !confirm(`Excluir ${client.name}?`)) return;
  state.clients = state.clients.filter((item) => item.id !== id);
  writeStorage();
  renderAll();
  showToast("Cliente excluido.");
}

function resetClientForm() {
  $("#clientForm").reset();
  $("#clientId").value = "";
  $("#clientFormTitle").textContent = "Novo cliente";
  $("#cancelClientEdit").classList.add("hidden");
}

function editServer(id) {
  const server = state.servers.find((item) => item.id === id);
  if (!server) return;
  $("#serverId").value = server.id;
  $("#serverName").value = server.name;
  $("#serverUrl").value = server.url;
  $("#serverNotes").value = server.notes;
  $("#serverFormTitle").textContent = "Editar servidor";
  $("#cancelServerEdit").classList.remove("hidden");
  setRoute("servers");
}

function deleteServer(id) {
  const server = state.servers.find((item) => item.id === id);
  if (!server || !confirm(`Excluir ${server.name}?`)) return;
  state.servers = state.servers.filter((item) => item.id !== id);
  writeStorage();
  renderAll();
  showToast("Servidor excluido.");
}

function resetServerForm() {
  $("#serverForm").reset();
  $("#serverId").value = "";
  $("#serverFormTitle").textContent = "Novo servidor";
  $("#cancelServerEdit").classList.add("hidden");
}

function getBillingAlerts() {
  return state.clients
    .filter((client) => {
      const days = daysUntil(client.paymentDate);
      return days >= 0 && days <= 3;
    })
    .sort((a, b) => daysUntil(a.paymentDate) - daysUntil(b.paymentDate));
}

function getInternalExpired() {
  return state.clients
    .filter((client) => daysUntil(client.internalDueDate) < 0)
    .sort((a, b) => daysUntil(a.internalDueDate) - daysUntil(b.internalDueDate));
}

function getInternalAlerts(maxDays) {
  return state.clients
    .filter((client) => {
      const days = daysUntil(client.internalDueDate);
      return days >= 0 && days <= maxDays;
    })
    .sort((a, b) => daysUntil(a.internalDueDate) - daysUntil(b.internalDueDate));
}

function countByStatus(status) {
  return state.clients.filter((client) => client.status === status).length;
}

function daysUntil(value) {
  const date = parseDate(value);
  if (!date) return Number.POSITIVE_INFINITY;
  return Math.round((date - today) / 86400000);
}

function daysLabel(days) {
  if (!Number.isFinite(days)) return "Sem data";
  if (days < 0) return `Venceu ha ${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "Vence hoje";
  return `${days} dia${days === 1 ? "" : "s"}`;
}

function billingMessage(client) {
  const days = daysUntil(client.paymentDate);
  const dayText = days === 0 ? "hoje" : `em ${days} dia${days === 1 ? "" : "s"}`;
  return `Olá ${client.name}! \u{1F60A} Estamos passando para avisar que seu plano de TV vence ${dayText} (dia ${formatDate(client.paymentDate)}). Gostaria de renovar? Entre em contato para garantir sua continuidade! \u{1F3AC}\u{1F4FA}`;
}

async function copyBillingMessage(id) {
  const client = state.clients.find((item) => item.id === id);
  if (!client) return;
  await navigator.clipboard.writeText(billingMessage(client));
  showToast("Mensagem copiada.");
}

function openWhatsApp(id) {
  const client = state.clients.find((item) => item.id === id);
  if (!client || !client.phone) return;
  window.open(`https://wa.me/${onlyDigits(client.phone)}?text=${encodeURIComponent(billingMessage(client))}`, "_blank", "noopener");
}

function seedExampleData() {
  const plusDays = (amount) => {
    const date = new Date(today);
    date.setDate(date.getDate() + amount);
    return date.toISOString().slice(0, 10);
  };

  const serverA = crypto.randomUUID();
  const serverB = crypto.randomUUID();
  state.servers = [
    { id: serverA, name: "Atlas Stream", url: "https://atlas.example", notes: "Servidor principal para planos premium." },
    { id: serverB, name: "Nebula IPTV", url: "https://nebula.example", notes: "Backup e testes de renovacao." },
  ];
  state.clients = [
    { id: crypto.randomUUID(), name: "Marina Costa", phone: "5511999990001", serverId: serverA, app: "XCIPTV", login: "marina.c", password: "1234", planValue: 39.9, status: "Ativo", paymentDate: plusDays(2), internalDueDate: plusDays(6) },
    { id: crypto.randomUUID(), name: "Rafael Lima", phone: "5521999990002", serverId: serverB, app: "Smart IPTV", login: "rafael.l", password: "abcd", planValue: 45, status: "Vencido", paymentDate: plusDays(-1), internalDueDate: plusDays(-2) },
    { id: crypto.randomUUID(), name: "Bianca Souza", phone: "5531999990003", serverId: serverA, app: "IBO Player", login: "bianca.s", password: "stream", planValue: 35, status: "Pago", paymentDate: plusDays(18), internalDueDate: plusDays(21) },
  ];
  writeStorage();
  resetClientForm();
  resetServerForm();
  renderAll();
  showToast("Dados de exemplo criados.");
}

function getServerName(id) {
  return state.servers.find((server) => server.id === id)?.name ?? "Sem servidor";
}

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return startOfDay(new Date(year, month - 1, day));
}

function startOfDay(date) {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function formatDate(value) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat("pt-BR").format(date) : "Sem data";
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

window.editClient = editClient;
window.deleteClient = deleteClient;
window.editServer = editServer;
window.deleteServer = deleteServer;
window.copyBillingMessage = copyBillingMessage;
window.openWhatsApp = openWhatsApp;
