import "./styles.css";
import Phaser from "phaser";

import {
  requestArchitectShift,
  type ArchitectShiftResponse,
} from "./api/architect";
import { fetchHealth } from "./api/health";
import { TitleScene } from "./scenes/TitleScene";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Expected #app root element");
}

app.innerHTML = `
  <div class="shell">
    <header class="overlay panel">
      <p class="eyebrow">Vertical Slice Alpha</p>
      <h1>RealityShift</h1>
      <p class="lede">
        A broken simulation. One trial. Limited charges. Ask the Architect for
        a stable rewrite and survive the constraint.
      </p>
      <div class="top-bar">
        <div class="status-row">
          <span class="status-label">Worker status</span>
          <span id="health-status" class="status-pill">Checking...</span>
        </div>
        <div class="status-row">
          <span class="status-label">Charges</span>
          <span id="charges-pill" class="status-pill accent">3 remaining</span>
        </div>
      </div>
    </header>

    <main class="game-layout">
      <section class="main-column">
        <div id="game-root" class="game-root" aria-label="RealityShift prototype canvas"></div>

        <div class="main-grid">
          <section class="overlay panel constraint-card">
            <div class="card-header">
              <div>
                <p class="section-label">Trial 01</p>
                <h2>Denied Ascent</h2>
              </div>
              <span class="mini-pill">Constraint Active</span>
            </div>
            <p class="card-copy">
              The simulation has disabled ordinary jumping. You still need to
              cross gaps and keep your momentum through a fractured arena.
            </p>
            <ul class="constraint-list">
              <li>Jumping is denied in this trial.</li>
              <li>Ask for movement, defense, or indirect combat help.</li>
              <li>Every successful rewrite costs 1 charge.</li>
            </ul>
          </section>

          <section class="overlay panel build-panel">
            <p class="section-label">Current Build</p>
            <h2 id="build-title">Baseline shell</h2>
            <p id="build-summary" class="card-copy">
              No loadout shift has been applied yet. The player remains in a
              default state with no authored advantage against the trial.
            </p>
            <div class="build-grid">
              <div>
                <span class="build-label">Movement</span>
                <p id="movement-value">Unshaped</p>
              </div>
              <div>
                <span class="build-label">Weapon</span>
                <p id="weapon-value">Unshaped</p>
              </div>
              <div>
                <span class="build-label">Passive</span>
                <p id="passive-value">Unshaped</p>
              </div>
            </div>
          </section>
        </div>
      </section>

      <aside class="overlay panel sidebar">
        <section class="architect-panel">
          <p class="section-label">Architect Console</p>
          <h2>Request a rewrite</h2>
          <p class="card-copy">
            Describe what kind of legal advantage you want. The Architect will
            return a safe mock loadout until live AI wiring is added.
          </p>
          <form id="architect-form" class="architect-form">
            <label class="sr-only" for="architect-input">Architect request</label>
            <textarea
              id="architect-input"
              name="prompt"
              rows="5"
              placeholder="Try: Give me a grounded dash build that can clear the gaps."
            ></textarea>
            <button id="architect-submit" type="submit">Submit Rewrite</button>
          </form>
        </section>

        <section>
          <p class="section-label">Suggested Prompts</p>
          <div class="prompt-list">
            <button class="prompt-chip" data-prompt="Give me a fast grounded dash that can cross gaps.">Fast grounded dash</button>
            <button class="prompt-chip" data-prompt="I want a defensive build that can survive a rough route.">Defensive route</button>
            <button class="prompt-chip" data-prompt="Give me a ranged build that helps me pressure the level from afar.">Ranged control</button>
          </div>
        </section>

        <section>
          <div class="card-header">
            <div>
              <p class="section-label">Architect Log</p>
              <h2>Recent Messages</h2>
            </div>
            <span id="log-badge" class="mini-pill">1 entry</span>
          </div>
          <div id="message-log" class="message-log" aria-live="polite"></div>
        </section>
      </aside>
    </main>
  </div>
`;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  width: 960,
  height: 540,
  backgroundColor: "#07111f",
  scene: [TitleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

void game;

type LoadoutState = {
  title: string;
  summary: string;
  movement: string;
  weapon: string;
  passive: string;
};

type MessageEntry = {
  role: "system" | "player" | "architect";
  text: string;
};

type SuccessfulArchitectShift = Extract<ArchitectShiftResponse, { ok: true }>;

const trialId = "trial_01_denied_ascent";

const runState: {
  charges: number;
  loadout: LoadoutState;
  messages: MessageEntry[];
} = {
  charges: 3,
  loadout: {
    title: "Baseline shell",
    summary:
      "No loadout shift has been applied yet. The player remains in a default state with no authored advantage against the trial.",
    movement: "Unshaped",
    weapon: "Unshaped",
    passive: "Unshaped",
  },
  messages: [
    {
      role: "system",
      text: "Trial loaded. Jumping is denied. The Architect is listening.",
    },
  ],
};

const healthStatus = document.querySelector<HTMLElement>("#health-status");
const chargesPill = document.querySelector<HTMLElement>("#charges-pill");
const buildTitle = document.querySelector<HTMLElement>("#build-title");
const buildSummary = document.querySelector<HTMLElement>("#build-summary");
const movementValue = document.querySelector<HTMLElement>("#movement-value");
const weaponValue = document.querySelector<HTMLElement>("#weapon-value");
const passiveValue = document.querySelector<HTMLElement>("#passive-value");
const messageLog = document.querySelector<HTMLElement>("#message-log");
const logBadge = document.querySelector<HTMLElement>("#log-badge");
const architectForm = document.querySelector<HTMLFormElement>("#architect-form");
const architectInput = document.querySelector<HTMLTextAreaElement>("#architect-input");
const architectSubmit = document.querySelector<HTMLButtonElement>("#architect-submit");
const promptChips = document.querySelectorAll<HTMLButtonElement>(".prompt-chip");

async function loadHealth() {
  if (!healthStatus) {
    return;
  }

  try {
    const result = await fetchHealth();
    healthStatus.textContent = result.ok
      ? `Healthy (${result.version})`
      : "Unexpected response";
    healthStatus.dataset.state = result.ok ? "ok" : "warning";
  } catch (error) {
    console.error(error);
    healthStatus.textContent = "Offline";
    healthStatus.dataset.state = "error";
  }
}

void loadHealth();

function pushMessage(role: MessageEntry["role"], text: string) {
  runState.messages = [...runState.messages, { role, text }];
  renderMessages();
}

function renderMessages() {
  if (!messageLog || !logBadge) {
    return;
  }

  messageLog.innerHTML = runState.messages
    .slice(-5)
    .map(
      (entry) => `
        <article class="log-entry" data-role="${entry.role}">
          <span class="log-role">${entry.role}</span>
          <p>${entry.text}</p>
        </article>
      `,
    )
    .join("");

  const entryCount = runState.messages.length;
  logBadge.textContent = `${entryCount} ${entryCount === 1 ? "entry" : "entries"}`;
}

function renderLoadout() {
  if (
    !buildTitle ||
    !buildSummary ||
    !movementValue ||
    !weaponValue ||
    !passiveValue
  ) {
    return;
  }

  buildTitle.textContent = runState.loadout.title;
  buildSummary.textContent = runState.loadout.summary;
  movementValue.textContent = runState.loadout.movement;
  weaponValue.textContent = runState.loadout.weapon;
  passiveValue.textContent = runState.loadout.passive;
}

function renderCharges() {
  if (!chargesPill) {
    return;
  }

  chargesPill.textContent = `${runState.charges} remaining`;
  chargesPill.dataset.state = runState.charges > 0 ? "charged" : "empty";
}

function applyShiftResponse(result: SuccessfulArchitectShift) {
  runState.charges = Math.max(0, runState.charges + result.chargesDelta);
  runState.loadout = {
    title: result.loadout.title,
    summary: result.loadout.summary,
    movement: result.loadout.movement.label,
    weapon: result.loadout.weapon.label,
    passive: result.loadout.passive.label,
  };

  if (result.validationWarnings.length > 0) {
    pushMessage("system", result.validationWarnings.join(" "));
  }

  pushMessage("architect", result.dialogue);
  renderCharges();
  renderLoadout();
}

async function submitArchitectPrompt(event: SubmitEvent) {
  event.preventDefault();

  if (!architectInput || !architectSubmit) {
    return;
  }

  const prompt = architectInput.value.trim();

  if (!prompt) {
    pushMessage("system", "The Architect requires a clear request.");
    return;
  }

  if (runState.charges <= 0) {
    pushMessage("system", "No charges remain. Restart the run to request another rewrite.");
    return;
  }

  architectSubmit.disabled = true;
  architectSubmit.textContent = "Rewriting...";
  pushMessage("player", prompt);

  try {
    const response = await requestArchitectShift({
      trialId,
      userText: prompt,
      currentLoadout: {
        title: runState.loadout.title,
        summary: runState.loadout.summary,
      },
      runId: "local-alpha-run",
    });

    if (!response.ok) {
      pushMessage("system", response.message);
      return;
    }

    applyShiftResponse(response);
    architectInput.value = "";
  } catch (error) {
    console.error(error);
    pushMessage("system", "The Architect interface lost coherence. Try again.");
  } finally {
    architectSubmit.disabled = false;
    architectSubmit.textContent = "Submit Rewrite";
  }
}

architectForm?.addEventListener("submit", (event) => {
  void submitArchitectPrompt(event);
});

promptChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    if (!architectInput) {
      return;
    }

    architectInput.value = chip.dataset.prompt ?? "";
    architectInput.focus();
  });
});

renderCharges();
renderLoadout();
renderMessages();
