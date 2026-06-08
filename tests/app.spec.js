const path = require("node:path");
const { test, expect } = require("@playwright/test");

const appUrl = `file://${path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/")}`;

async function fillServer(page, name, url, notes) {
  await page.getByRole("button", { name: "Servidores" }).click();
  await page.locator("#serverName").fill(name);
  await page.locator("#serverUrl").fill(url);
  await page.locator("#serverNotes").fill(notes);
  await page.getByRole("button", { name: "Salvar servidor" }).click();
}

async function fillClient(page, client) {
  await page.getByRole("button", { name: "Clientes" }).click();
  await page.locator("#clientName").fill(client.name);
  await page.locator("#clientPhone").fill(client.phone);
  await page.locator("#clientServer").selectOption({ label: client.server });
  await page.locator("#clientApp").fill(client.app);
  await page.locator("#clientLogin").fill(client.login);
  await page.locator("#clientPassword").fill(client.password);
  await page.locator("#clientPlanValue").fill(client.planValue);
  await page.locator("#clientStatus").selectOption(client.status);
  await page.locator("#clientPaymentDate").fill(client.paymentDate);
  await page.locator("#clientInternalDueDate").fill(client.internalDueDate);
  await page.getByRole("button", { name: "Salvar cliente" }).click();
}

function isoDate(offsetDays) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

test.beforeEach(async ({ page }) => {
  await page.goto(appUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("CRUD, dashboard, billing message and persistence work", async ({ page, context }) => {
  await expect(page).toHaveTitle("TV Client Manager");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await fillServer(page, "Atlas Stream", "https://atlas.example", "Principal");
  await fillServer(page, "Nebula IPTV", "https://nebula.example", "Backup");
  await expect(page.locator("#serversList")).toContainText("Atlas Stream");
  await expect(page.locator("#serversList")).toContainText("Nebula IPTV");

  await fillClient(page, {
    name: "Marina Costa",
    phone: "5511999990001",
    server: "Atlas Stream",
    app: "XCIPTV",
    login: "marina.c",
    password: "1234",
    planValue: "39.90",
    status: "Ativo",
    paymentDate: isoDate(2),
    internalDueDate: isoDate(6),
  });
  await fillClient(page, {
    name: "Rafael Lima",
    phone: "5521999990002",
    server: "Nebula IPTV",
    app: "Smart IPTV",
    login: "rafael.l",
    password: "abcd",
    planValue: "45",
    status: "Vencido",
    paymentDate: isoDate(4),
    internalDueDate: isoDate(-2),
  });
  await fillClient(page, {
    name: "Bianca Souza",
    phone: "5531999990003",
    server: "Atlas Stream",
    app: "IBO Player",
    login: "bianca.s",
    password: "stream",
    planValue: "35",
    status: "Pago",
    paymentDate: isoDate(18),
    internalDueDate: isoDate(21),
  });

  await expect(page.locator("#clientsTable")).toContainText("Marina Costa");
  await expect(page.locator("#clientsTable")).toContainText("Rafael Lima");
  await expect(page.locator("#clientsTable")).toContainText("Bianca Souza");

  await page.getByRole("button", { name: "Dashboard" }).click();
  await expect(page.locator("#summaryCards")).toContainText("Ativos");
  await expect(page.locator("#summaryCards")).toContainText("Vencidos interno");
  await expect(page.locator("#dashboardBillingAlerts")).toContainText("Marina Costa");
  await expect(page.locator("#dashboardInternalAlerts")).toContainText("Marina Costa");

  await page.getByRole("button", { name: "Cobrancas" }).click();
  await expect(page.locator("#billingList")).toContainText("Marina Costa");
  await expect(page.locator("#billingList")).toContainText("Olá Marina Costa!");
  await expect(page.locator("#billingList")).toContainText("😊");
  await expect(page.locator("#billingList")).toContainText("🎬📺");
  await expect(page.locator("#billingList")).toContainText("vence em 2 dias");

  const popupPromise = context.waitForEvent("page");
  await page.getByRole("button", { name: "WhatsApp" }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/phone=5511999990001|wa\.me\/5511999990001/);
  await popup.close();

  await page.getByRole("button", { name: "Clientes" }).click();
  await page.locator("#clientsTable tr", { hasText: "Marina Costa" }).getByTitle("Editar").click();
  await page.locator("#clientName").fill("Marina Costa Atualizada");
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await expect(page.locator("#clientsTable")).toContainText("Marina Costa Atualizada");

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#clientsTable tr", { hasText: "Marina Costa Atualizada" }).getByTitle("Excluir").click();
  await expect(page.locator("#clientsTable")).not.toContainText("Marina Costa Atualizada");

  await page.reload();
  await page.getByRole("button", { name: "Servidores" }).click();
  await expect(page.locator("#serversList")).toContainText("Atlas Stream");
  await page.getByRole("button", { name: "Clientes" }).click();
  await expect(page.locator("#clientsTable")).toContainText("Rafael Lima");
  await expect(page.locator("#clientsTable")).toContainText("Bianca Souza");
});

test("search, status filter and seed data button work", async ({ page }) => {
  await page.getByRole("button", { name: "Dados exemplo" }).click();
  await page.getByRole("button", { name: "Clientes" }).click();

  await page.locator("#clientSearch").fill("bianca");
  await expect(page.locator("#clientsTable")).toContainText("Bianca Souza");
  await expect(page.locator("#clientsTable")).not.toContainText("Marina Costa");

  await page.locator("#clientSearch").fill("");
  await page.locator("#clientStatusFilter").selectOption("Vencido");
  await expect(page.locator("#clientsTable")).toContainText("Rafael Lima");
  await expect(page.locator("#clientsTable")).not.toContainText("Bianca Souza");
});
