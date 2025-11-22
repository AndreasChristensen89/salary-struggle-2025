// Dialogue & core game logic largely kept from original, UI re-wired to new layout.

// Simple dialogue "JSON" that you can later move into a separate .json file
const DIALOGUE = {
  home: {
    self: [
      "You wake up. 30 days to find a full-time job.",
      "Another day. You need money, stats, and luck."
    ]
  },
  downtown: {
    self: [
      "Downtown is busy. Lights, people, noise everywhere.",
      "From here, you can reach most places you need."
    ]
  },
  industrial: {
    self: [
      "The industrial area is rough but full of work.",
      "Warehouses, factories, and tired workers."
    ]
  },
  bar: {
    bartender: [
      "Welcome. Take it slow. A drink can help your confidence.",
      "Charm isn't just looks. It's how you talk and listen."
    ],
    stranger: [
      "They say the big boss loves punctual people.",
      "He hates gossip. If you talk behind backs, you're done.",
      "He likes short, clear answers. No long speeches.",
      "He respects people who refuse to gossip about others."
    ]
  },
  gym: {
    trainer: [
      "Strong legs, strong mind. Keep moving.",
      "Endurance keeps you calm in long interviews."
    ]
  },
  library: {
    clerk: [
      "Quiet is good for thinking.",
      "Study now. Impress them later."
    ]
  },
  conbini: {
    boss: [
      "You're hired. Right now. Grab an apron.",
      "This job won't make you rich, but it helps."
    ]
  },
  callcenter: {
    boss: [
      "We only take people who can talk clearly.",
      "Okay. You can try a shift. Don't scare the customers."
    ]
  },
  gambling: {
    dealer: [
      "High risk, high reward. Or just loss.",
      "Only bet what you can lose, kid."
    ]
  },
  recruiter: {
    recruiter: [
      "You want me to represent you? Show me something.",
      "Stats matter. So does how you handle pressure."
    ],
    interviewer: [
      "First we do a small test. Try not to fail too hard.",
      "If you fail, rest and try again tomorrow."
    ],
    boss: [
      "So, you are the candidate. I dislike wasted time.",
      "We will see if your choices fit my taste."
    ]
  }
};

// Game state
const gameState = {
  day: 1,
  energy: 100,
  charm: 1,
  knowledge: 1,
  endurance: 1,
  level: 0,          // 0 = not accepted by recruiter, 1-4 = interview stages, 5 = full-time job
  money: 5000,
  location: "home",
  callCenterUnlocked: false,
  gameOver: false,
  interviews: {
    1: { lastAttemptDay: 0, passed: false },
    2: { lastAttemptDay: 0, passed: false },
    3: { lastAttemptDay: 0, passed: false },
    4: { lastAttemptDay: 0, passed: false }
  }
};

let activeInterview = null; // holds runtime data for current interview mini-game

// Location metadata (including hubs)
const LOCATIONS = {
  home: {
    name: "Home",
    desc: "Your small apartment. A place to rest and plan."
  },
  downtown: {
    name: "Downtown",
    desc: "Bright signs, offices, shops. Many paths start here."
  },
  industrial: {
    name: "Industrial Area",
    desc: "Warehouses and work. Less shine, more sweat."
  },
  bar: {
    name: "Bar",
    desc: "Neon lights and quiet music. You can relax and boost your charm."
  },
  gym: {
    name: "Gym",
    desc: "Metal, sweat, and focus. Endurance is built here."
  },
  library: {
    name: "Library",
    desc: "Quiet stacks of books. A good place to study."
  },
  conbini: {
    name: "Convenience Store",
    desc: "Snacks, drinks, and endless shelf-stacking."
  },
  callcenter: {
    name: "Call Center",
    desc: "Headsets and scripts. People call with all kinds of problems."
  },
  gambling: {
    name: "Gambling Den",
    desc: "Low light, tense faces. Big wins or bad nights."
  },
  recruiter: {
    name: "Recruiter Office",
    desc: "A clean office. Here you climb the interview ladder."
  }
};

// Optional: character to show per location (sprites will be added later)
const CHARACTER_BY_LOCATION = {
  home: "protagonist",
  downtown: "protagonist",
  industrial: "worker",
  bar: "bartender",
  gym: "trainer",
  library: "clerk",
  conbini: "boss",
  callcenter: "boss",
  gambling: "dealer",
  recruiter: ""
};

// Navigation graph: which places can you reach from where?
const LOCATION_GRAPH = {
  home:        ["downtown"],
  downtown:    ["home", "industrial", "bar", "library", "recruiter", "gambling"],
  industrial:  ["downtown", "gym", "conbini", "callcenter"],
  bar:         ["downtown"],
  library:     ["downtown"],
  recruiter:   ["downtown"],
  gambling:    ["downtown"],
  gym:         ["industrial"],
  conbini:     ["industrial"],
  callcenter:  ["industrial"]
};

document.addEventListener("DOMContentLoaded", () => {
  initUI();
  goToLocation("home");
  logRandomDialogue("home", "self");
});

/* ---------- UI helpers ---------- */

function initUI() {
  const moveToggle = document.getElementById("moveToggle");
  const sprite = document.getElementById("characterSprite");
  const statsIconBtn = document.getElementById("statsIconBtn");

  if (statsIconBtn) {
    statsIconBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleStatsPanel();
    });
  }

  if (moveToggle) {
    moveToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMovePanel();
    });
  }

  // Character sprite fallback (placeholder if sprite not found)
  if (sprite) {
    sprite.addEventListener("error", () => {
      // sprite.src = "assets/characters/placeholder.png";
      sprite.src = "";
    });
  }

  // Click outside stats/move to close (but not interview)
  document.addEventListener("click", (e) => {
    const statsPanel = document.getElementById("statsPanel");
    const movePanel = document.getElementById("movePanel");
    const statsIcon = document.getElementById("statsIconBtn");
    const moveBtn = document.getElementById("moveToggle");

    // Stats: if open, and click outside card + button, close
    if (statsPanel && statsPanel.classList.contains("open")) {
      const card = statsPanel.querySelector(".overlay-card");
      const clickedInsideCard = card && card.contains(e.target);
      const clickedBtn = statsIcon && statsIcon.contains(e.target);
      if (!clickedInsideCard && !clickedBtn) {
        closePanel("statsPanel");
      }
    }

    // Move: same logic
    if (movePanel && movePanel.classList.contains("open")) {
      const card = movePanel.querySelector(".overlay-card");
      const clickedInsideCard = card && card.contains(e.target);
      const clickedBtn = moveBtn && moveBtn.contains(e.target);
      if (!clickedInsideCard && !clickedBtn) {
        closePanel("movePanel");
      }
    }
  });

  renderStats();
}

/* Shared open/close helpers for stats & move */

function openPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel || gameState.gameOver) return;
  if (!panel.classList.contains("hidden") && panel.classList.contains("open")) return;

  panel.classList.remove("hidden");

  // Wait a tick so transition can run
  requestAnimationFrame(() => {
    panel.classList.add("open");
  });
}

function closePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel || panel.classList.contains("hidden")) return;

  panel.classList.remove("open");
  const onEnd = () => {
    panel.classList.add("hidden");
  };
  panel.addEventListener("transitionend", onEnd, { once: true });
}

function toggleStatsPanel() {
  const panel = document.getElementById("statsPanel");
  if (!panel || gameState.gameOver) return;
  if (panel.classList.contains("hidden") || !panel.classList.contains("open")) {
    openPanel("statsPanel");
  } else {
    closePanel("statsPanel");
  }
}

function toggleMovePanel() {
  const panel = document.getElementById("movePanel");
  if (!panel || gameState.gameOver) return;
  if (panel.classList.contains("hidden") || !panel.classList.contains("open")) {
    openPanel("movePanel");
  } else {
    closePanel("movePanel");
  }
}

function renderStats() {
  const { day, energy, charm, knowledge, endurance, level, money } = gameState;

  const dayEl = document.getElementById("stat-day");
  const energyEl = document.getElementById("stat-energy");
  const charmEl = document.getElementById("stat-charm");
  const knowledgeEl = document.getElementById("stat-knowledge");
  const enduranceEl = document.getElementById("stat-endurance");
  const levelEl = document.getElementById("stat-level");
  const moneyEl = document.getElementById("stat-money");

  if (dayEl) dayEl.textContent = day;
  if (energyEl) energyEl.textContent = energy;
  if (charmEl) charmEl.textContent = charm;
  if (knowledgeEl) knowledgeEl.textContent = knowledge;
  if (enduranceEl) enduranceEl.textContent = endurance;
  if (levelEl) levelEl.textContent = level;
  if (moneyEl) moneyEl.textContent = money;

  const statsToggle = document.getElementById("statsToggle");
  if (statsToggle) {
    statsToggle.textContent = `Day ${day}`;
  }
}

function updateVisualsForLocation(locationKey) {
  const meta = LOCATIONS[locationKey];
  const locationName = document.getElementById("locationName");
  const locationDesc = document.getElementById("locationDesc");

  if (locationName) locationName.textContent = meta ? meta.name : locationKey;
  if (locationDesc) locationDesc.textContent = meta ? meta.desc : "";

  const bgLayer = document.getElementById("backgroundLayer");
  if (bgLayer) {
    // Expects assets/backgrounds/<locationKey>.png; if missing, gradient stays
    bgLayer.style.backgroundImage = `url('assets/backgrounds/${locationKey}.png')`;
  }

  // Character sprite update
  const sprite = document.getElementById("characterSprite");
  // const charId = CHARACTER_BY_LOCATION[locationKey] || "protagonist";
  const charId = CHARACTER_BY_LOCATION[locationKey] || "";
  if (sprite) {
    sprite.dataset.character = charId;
    sprite.src = `assets/characters/${charId}.png`;
    sprite.alt = charId;
  }
}

function goToLocation(locationKey) {
  if (gameState.gameOver) return;

  gameState.location = locationKey;
  document.body.className = `location-${locationKey}`;

  updateVisualsForLocation(locationKey);

  // Close move panel when moving
  closePanel("movePanel");

  const interviewArea = document.getElementById("interviewArea");
  if (interviewArea) {
    interviewArea.classList.add("hidden");
    interviewArea.innerHTML = "";
  }
  activeInterview = null;

  buildActionsForLocation(locationKey);
  renderNavigation();

  // Ambient line on entering
  if (locationKey === "home") {
    logRandomDialogue("home", "self");
  } else if (locationKey === "downtown") {
    logRandomDialogue("downtown", "self");
  } else if (locationKey === "industrial") {
    logRandomDialogue("industrial", "self");
  } else if (locationKey === "bar") {
    logRandomDialogue("bar", "bartender");
  } else if (locationKey === "gym") {
    logRandomDialogue("gym", "trainer");
  } else if (locationKey === "library") {
    logRandomDialogue("library", "clerk");
  } else if (locationKey === "recruiter") {
    logRandomDialogue("recruiter", "recruiter");
  }
}

function renderNavigation() {
  const container = document.getElementById("navButtons");
  if (!container) return;

  container.innerHTML = "";

  const neighbors = LOCATION_GRAPH[gameState.location] || [];
  if (!neighbors.length) {
    const p = document.createElement("p");
    p.textContent = "No paths from here.";
    container.appendChild(p);
    return;
  }

  neighbors.forEach((locKey) => {
    const btn = document.createElement("button");
    btn.className = "nav-btn";
    btn.textContent = LOCATIONS[locKey].name;
    btn.addEventListener("click", () => goToLocation(locKey));
    container.appendChild(btn);
  });
}

function buildActionsForLocation(locationKey) {
  const container = document.getElementById("actions");
  if (!container) return;

  container.innerHTML = "";

  const addBtn = (label, onClick, disabled = false, tooltip = "") => {
    const btn = document.createElement("button");
    btn.className = "action-btn";
    if (disabled) btn.classList.add("disabled");
    btn.textContent = label;
    if (tooltip) btn.title = tooltip;
    if (!disabled) {
      btn.addEventListener("click", onClick);
    }
    container.appendChild(btn);
  };

  if (gameState.gameOver) return;

  switch (locationKey) {
    case "home":
      addBtn("Sleep (restore, next day)", sleep);
      addBtn("Overthink your future", () => {
        log("You imagine every possible failure. Somehow, it motivates you.", "You");
      });
      break;

    case "downtown":
      addBtn("Look around", () => {
        log("Neon, noise, and people who all look more prepared than you.", "Narrator");
      });
      break;

    case "industrial":
      addBtn("Watch the trucks", () => {
        if (!spendEnergy(5)) return;
        log("You watch workers load trucks. Your back hurts in sympathy.", "Narrator");
      });
      break;

    case "bar":
      addBtn("Have a drink (+Charm, -Energy, -¥1500)", () => {
        if (!spendEnergy(15)) return;
        if (!spendMoney(1500)) return;
        gameState.charm++;
        showResourceChange("Charm", +1);
        renderStats();
        log("You talk nonsense with strangers until your social skills level up.", "Narrator");
        maybeHintFromStranger();
      });
      addBtn("Talk to a stranger", () => {
        logRandomDialogue("bar", "stranger");
      });
      break;

    case "gym":
      addBtn("Workout (+Endurance, -Energy, -¥1000)", () => {
        if (!spendEnergy(25)) return;
        if (!spendMoney(1000)) return;
        gameState.endurance++;
        showResourceChange("Endurance", +1);
        renderStats();
        logRandomDialogue("gym", "trainer");
      });
      break;

    case "library":
      addBtn("Study (+Knowledge, -Energy, -¥500)", () => {
        if (!spendEnergy(20)) return;
        if (!spendMoney(500)) return;
        gameState.knowledge++;
        showResourceChange("Knowledge", +1);
        renderStats();
        logRandomDialogue("library", "clerk");
      });
      break;

    case "conbini":
      addBtn("Work a shift (+¥3500, +Endurance, -Energy)", () => {
        if (!spendEnergy(30)) return;
        gameState.money += 3500;
        gameState.endurance++;
        showResourceChange("Money", +3500);
        showResourceChange("Endurance", +1);
        renderStats();
        logRandomDialogue("conbini", "boss");
      });
      break;

    case "callcenter": {
      const canUnlock =
        !gameState.callCenterUnlocked &&
        gameState.charm >= 3 &&
        gameState.knowledge >= 2;

      if (!gameState.callCenterUnlocked) {
        addBtn(
          "Apply for call center job",
          () => {
            if (canUnlock) {
              gameState.callCenterUnlocked = true;
              log("The supervisor nods. \"Fine. You sound just barely acceptable.\"", "Narrator");
              logRandomDialogue("callcenter", "boss");
            } else {
              log("The supervisor squints. \"Come back when you sound less like a dying potato.\"", "Call Center Boss");
            }
          },
          false,
          "Requires Charm ≥ 3 and Knowledge ≥ 2"
        );
      }

      addBtn(
        "Work a shift (+¥4500, +Charm, -Energy)",
        () => {
          if (!gameState.callCenterUnlocked) {
            log("You haven't been accepted here yet.", "Narrator");
            return;
          }
          if (!spendEnergy(25)) return;
          gameState.money += 4500;
          gameState.charm++;
          showResourceChange("Money", +4500);
          showResourceChange("Charm", +1);
          renderStats();
          log("You survive a full day of complaints. Your empathy and sarcasm both gain XP.", "Narrator");
        },
        false
      );
      break;
    }

    case "gambling":
      addBtn("Place a risky bet (-¥3000, 50% chance +¥9000)", () => {
        if (!spendMoney(3000)) return;
        if (!spendEnergy(10)) {
          // refund if no energy
          gameState.money += 3000;
          renderStats();
          return;
        }
        const win = Math.random() < 0.5;
        if (win) {
          gameState.money += 9000;
          showResourceChange("Money", +9000);
          log("You win this round. The dealer looks annoyed. You immediately fear karma.", "Dealer");
        } else {
          log("You lose. The dealer smiles like they just got promoted.", "Dealer");
        }
        renderStats();
      });
      addBtn("Chat with the dealer", () => {
        logRandomDialogue("gambling", "dealer");
      });
      break;

    case "recruiter":
      buildRecruiterActions(addBtn);
      break;
  }
}

function buildRecruiterActions(addBtn) {
  const level = gameState.level;

  // Initial acceptance as client
  if (level === 0) {
    addBtn("Beg recruiter for mercy", () => {
      const meetsStats =
        gameState.charm >= 2 &&
        gameState.knowledge >= 2 &&
        gameState.endurance >= 2;

      if (meetsStats) {
        gameState.level = 1;
        renderStats();
        log(
          "\"Fine. Your stats are barely above tragic. I'll take you as a client.\"",
          "Recruiter"
        );
        log(
          "First interview is now open. Try not to self-destruct.",
          "Narrator"
        );
      } else {
        log(
          "\"Work on yourself first. I am not a miracle worker.\"",
          "Recruiter"
        );
      }
    });
  }

  // Interview buttons
  if (gameState.level >= 1 && !gameState.interviews[1].passed) {
    addBtn("First interview: Math screening", startInterview1);
  } else if (gameState.interviews[1].passed && !gameState.interviews[2].passed) {
    addBtn("Second interview: Multiple-choice test", startInterview2);
  } else if (gameState.interviews[2].passed && !gameState.interviews[3].passed) {
    addBtn("Third interview: Color reaction test", startInterview3);
  } else if (gameState.interviews[3].passed && !gameState.interviews[4].passed) {
    addBtn("Final boss interview: Big boss preferences", startInterview4);
  }

  if (gameState.interviews[4].passed) {
    addBtn("Receive final decision", () => {
      if (gameState.level < 5) {
        gameState.level = 5;
        renderStats();
        log(
          "The recruiter calls. \"They hired you. Somehow.\"",
          "Recruiter"
        );
        endGame(true);
      } else {
        log("You already got the job. Now you just grind salary instead of XP.", "Narrator");
      }
    });
  }

  addBtn("Chat with recruiter", () => {
    logRandomDialogue("recruiter", "recruiter");
  });
}

/* ---------- Resource change flashes ---------- */

function showResourceChange(type, delta) {
  const container = document.getElementById("resourceFloats");
  if (!container || !delta) return;

  let icon = "";
  switch (type) {
    case "Energy":
      icon = "⚡";
      break;
    case "Money":
      icon = "¥";
      break;
    case "Charm":
      icon = "✨";
      break;
    case "Knowledge":
      icon = "📚";
      break;
    case "Endurance":
      icon = "🏃";
      break;
    default:
      icon = "";
  }

  const el = document.createElement("div");
  el.className = "resource-float";

  const sign = delta > 0 ? "+" : "−";
  const value = Math.abs(delta);

  if (type === "Money") {
    el.textContent = `${sign}¥${value}`;
  } else if (icon) {
    el.textContent = `${sign}${value} ${icon}`;
  } else {
    el.textContent = `${sign}${value}`;
  }

  container.appendChild(el);

  requestAnimationFrame(() => {
    el.classList.add("show");
  });

  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 200);
  }, 900);
}

/* ---------- Generic actions ---------- */

function sleep() {
  if (gameState.gameOver) return;

  gameState.day += 1;
  if (gameState.day > 30) {
    renderStats();
    endGame(false);
    return;
  }

  gameState.energy = 100;

  // Simple daily cost
  const rentCost = 2000;
  gameState.money = Math.max(0, gameState.money - rentCost);
  showResourceChange("Money", -rentCost);

  renderStats();
  log(`You sleep. It's now day ${gameState.day}. Rent eats ¥${rentCost} like a boss monster.`, "Narrator");
}

function spendEnergy(cost) {
  if (gameState.energy < cost) {
    log("You are too tired. Even your eyebags have eyebags. Go home and sleep.", "Narrator");
    return false;
  }
  gameState.energy -= cost;
  showResourceChange("Energy", -cost);
  renderStats();
  return true;
}

function spendMoney(amount) {
  if (gameState.money < amount) {
    log("You reach for your wallet. The wallet reaches for help.", "Narrator");
    return false;
  }
  gameState.money -= amount;
  showResourceChange("Money", -amount);
  renderStats();
  return true;
}

// SINGLE-MESSAGE LOG: one VN-style line at a time
function log(msg, speaker = null) {
  const speakerEl = document.getElementById("dialogueSpeaker");
  const textEl = document.getElementById("dialogueText");
  if (!speakerEl || !textEl) return;

  speakerEl.textContent = speaker || "";
  textEl.textContent = msg;
}

function logRandomDialogue(locationKey, speakerKey) {
  const loc = DIALOGUE[locationKey];
  if (!loc) return;
  const lines = loc[speakerKey];
  if (!lines || !lines.length) return;
  const line = lines[Math.floor(Math.random() * lines.length)];
  log(line, speakerNameFromKey(speakerKey));
}

function speakerNameFromKey(key) {
  switch (key) {
    case "self": return "You";
    case "bartender": return "Bartender";
    case "stranger": return "Stranger";
    case "trainer": return "Trainer";
    case "clerk": return "Librarian";
    case "boss": return "Boss";
    case "dealer": return "Dealer";
    case "recruiter": return "Recruiter";
    case "interviewer": return "Interviewer";
    default: return key;
  }
}

function maybeHintFromStranger() {
  // Small chance to automatically share a hint when drinking
  if (Math.random() < 0.35) {
    logRandomDialogue("bar", "stranger");
  }
}

function endGame(success) {
  gameState.gameOver = true;
  if (success) {
    log(
      "You found a full-time job within 30 days. Congratulations, you're now a responsible adult NPC.",
      "Narrator"
    );
  } else {
    log(
      "Day 31 arrives. No job, no money. New difficulty unlocked: \"Hard mode: Reality.\"",
      "Narrator"
    );
  }
}

/* ---------- Interview 1: Math screening ---------- */

function canAttemptInterview(n) {
  const info = gameState.interviews[n];
  return info.lastAttemptDay !== gameState.day && !info.passed;
}

function markAttemptInterview(n) {
  gameState.interviews[n].lastAttemptDay = gameState.day;
}

function startInterview1() {
  if (!canAttemptInterview(1)) {
    log("The interviewer sighs. \"One attempt per day. This isn’t a gacha game.\"", "Interviewer");
    return;
  }

  markAttemptInterview(1);
  gameState.level = Math.max(gameState.level, 1);
  renderStats();

  const area = document.getElementById("interviewArea");
  if (!area) return;

  area.classList.remove("hidden");
  area.innerHTML = `
    <div class="overlay-card">
      <div class="overlay-header">
        <h3>First Interview: Math Screening</h3>
        <span class="small-note">Answer a few short math questions. You need at least 60% correct.</span>
      </div>
      <div id="int1-question" class="interview-question"></div>
      <input id="int1-answer" class="interview-input" type="number" />
      <button id="int1-submit" class="action-btn">Submit</button>
    </div>
  `;

  const questions = [];
  for (let i = 0; i < 5; i++) {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const op = Math.random() < 0.5 ? "+" : "-";
    const answer = op === "+" ? a + b : a - b;
    questions.push({ a, b, op, answer });
  }

  activeInterview = {
    type: 1,
    index: 0,
    correct: 0,
    total: questions.length,
    questions
  };

  showInterview1Question();

  document
    .getElementById("int1-submit")
    .addEventListener("click", handleInterview1Submit);
}

function showInterview1Question() {
  const q = activeInterview.questions[activeInterview.index];
  const qDiv = document.getElementById("int1-question");
  const input = document.getElementById("int1-answer");
  if (!qDiv || !input) return;
  qDiv.textContent = `Q${activeInterview.index + 1}: ${q.a} ${q.op} ${q.b} = ?`;
  input.value = "";
  input.focus();
}

function handleInterview1Submit() {
  const input = document.getElementById("int1-answer");
  if (!input) return;
  const val = parseInt(input.value, 10);
  const q = activeInterview.questions[activeInterview.index];

  if (!Number.isNaN(val) && val === q.answer) {
    activeInterview.correct++;
  }

  activeInterview.index++;
  if (activeInterview.index >= activeInterview.total) {
    finishInterview1();
  } else {
    showInterview1Question();
  }
}

function finishInterview1() {
  const score = (activeInterview.correct / activeInterview.total) * 100;
  const area = document.getElementById("interviewArea");

  if (score >= 60) {
    gameState.interviews[1].passed = true;
    gameState.level = Math.max(gameState.level, 2);
    renderStats();
    log(
      `"Barely good enough. But it passes." (Score: ${score.toFixed(0)}%)`,
      "Interviewer"
    );
  } else {
    log(
      `"That was weak. Even my calculator is disappointed." (Score: ${score.toFixed(0)}%)`,
      "Interviewer"
    );
  }

  activeInterview = null;
  if (area) {
    area.classList.add("hidden");
    area.innerHTML = "";
  }
}

/* ---------- Interview 2: Multiple-choice test ---------- */

const INTERVIEW2_QUESTIONS = [
  {
    q: "A client sends you an angry email about a small delay. What do you do first?",
    options: [
      "Ignore it and hope it disappears.",
      "Reply quickly, apologize, and propose a clear next step.",
      "Forward it to everyone and complain."
    ],
    correct: 1
  },
  {
    q: "You notice a mistake in a report you already sent to your manager.",
    options: [
      "Wait and see if they notice.",
      "Tell them fast, explain the impact, and send a fixed version.",
      "Blame another colleague."
    ],
    correct: 1
  },
  {
    q: "In a meeting, you don’t understand part of the discussion.",
    options: [
      "Stay silent so nobody notices.",
      "Ask a short, clear question to understand.",
      "Change the topic."
    ],
    correct: 1
  },
  {
    q: "You are on a long task and feel your focus drop.",
    options: [
      "Take a short break, then continue.",
      "Scroll social media for 30 minutes.",
      "Give up for the day right away."
    ],
    correct: 0
  }
];

function startInterview2() {
  if (!canAttemptInterview(2)) {
    log("\"One attempt per day. Let your brain cool down.\"", "Interviewer");
    return;
  }
  markAttemptInterview(2);
  gameState.level = Math.max(gameState.level, 2);
  renderStats();

  const area = document.getElementById("interviewArea");
  if (!area) return;

  area.classList.remove("hidden");
  area.innerHTML = `
    <div class="overlay-card">
      <div class="overlay-header">
        <h3>Second Interview: Workplace Scenarios</h3>
        <span class="small-note">Pick the best answer. You need at least 75% correct.</span>
      </div>
      <div id="int2-question" class="interview-question"></div>
      <div id="int2-options" class="interview-options"></div>
      <button id="int2-next" class="action-btn">Next</button>
    </div>
  `;

  activeInterview = {
    type: 2,
    index: 0,
    correct: 0,
    total: INTERVIEW2_QUESTIONS.length
  };

  showInterview2Question();

  document.getElementById("int2-next").addEventListener("click", () => {
    handleInterview2Next();
  });
}

function showInterview2Question() {
  const qData = INTERVIEW2_QUESTIONS[activeInterview.index];
  const qDiv = document.getElementById("int2-question");
  const optDiv = document.getElementById("int2-options");
  if (!qDiv || !optDiv) return;

  qDiv.textContent = `Q${activeInterview.index + 1}: ${qData.q}`;
  optDiv.innerHTML = "";

  qData.options.forEach((opt, idx) => {
    const id = `int2-opt-${idx}`;
    const label = document.createElement("label");
    label.innerHTML = `<input type="radio" name="int2" value="${idx}" id="${id}" /> ${opt}`;
    optDiv.appendChild(label);
  });
}

function handleInterview2Next() {
  const selected = document.querySelector('input[name="int2"]:checked');
  if (!selected) {
    log("The interviewer frowns. \"Pick something, not nothing.\"", "Interviewer");
    return;
  }
  const choice = parseInt(selected.value, 10);
  const qData = INTERVIEW2_QUESTIONS[activeInterview.index];

  if (choice === qData.correct) {
    activeInterview.correct++;
  }

  activeInterview.index++;
  if (activeInterview.index >= activeInterview.total) {
    finishInterview2();
  } else {
    showInterview2Question();
  }
}

function finishInterview2() {
  const score = (activeInterview.correct / activeInterview.total) * 100;
  const area = document.getElementById("interviewArea");

  if (score >= 75) {
    gameState.interviews[2].passed = true;
    gameState.level = Math.max(gameState.level, 3);
    renderStats();
    log(
      `"You made mostly good choices. You might survive in an office." (Score: ${score.toFixed(0)}%)`,
      "Interviewer"
    );
  } else {
    log(
      `"If you treated real clients like that, HR would cry." (Score: ${score.toFixed(0)}%)`,
      "Interviewer"
    );
  }

  activeInterview = null;
  if (area) {
    area.classList.add("hidden");
    area.innerHTML = "";
  }
}

/* ---------- Interview 3: Color reaction test ---------- */

function startInterview3() {
  if (!canAttemptInterview(3)) {
    log("\"Reflexes only get one chance per day.\"", "Interviewer");
    return;
  }
  markAttemptInterview(3);
  gameState.level = Math.max(gameState.level, 3);
  renderStats();

  const area = document.getElementById("interviewArea");
  if (!area) return;

  area.classList.remove("hidden");
  area.innerHTML = `
    <div class="overlay-card">
      <div class="overlay-header">
        <h3>Third Interview: Color Reaction Test</h3>
        <span class="small-note">Click the button that matches the color name. You need at least 70% correct.</span>
      </div>
      <div id="int3-question" class="interview-question"></div>
      <div class="color-buttons">
        <button class="color-btn color-green" data-color="green">Green</button>
        <button class="color-btn color-blue" data-color="blue">Blue</button>
        <button class="color-btn color-yellow" data-color="yellow">Yellow</button>
      </div>
    </div>
  `;

  activeInterview = {
    type: 3,
    round: 0,
    total: 10,
    correct: 0,
    target: null
  };

  document.querySelectorAll(".color-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      handleInterview3Click(btn.dataset.color);
    });
  });

  nextInterview3Round();
}

function nextInterview3Round() {
  if (!activeInterview || activeInterview.type !== 3) return;
  if (activeInterview.round >= activeInterview.total) {
    finishInterview3();
    return;
  }

  activeInterview.round++;
  const colors = ["green", "blue", "yellow"];
  const target = colors[Math.floor(Math.random() * colors.length)];
  activeInterview.target = target;

  const qDiv = document.getElementById("int3-question");
  if (!qDiv) return;
  qDiv.textContent = `Round ${activeInterview.round}/${activeInterview.total}: Click "${target.toUpperCase()}"`;
}

function handleInterview3Click(color) {
  if (!activeInterview || activeInterview.type !== 3) return;

  if (color === activeInterview.target) {
    activeInterview.correct++;
  }

  nextInterview3Round();
}

function finishInterview3() {
  const score = (activeInterview.correct / activeInterview.total) * 100;
  const area = document.getElementById("interviewArea");

  if (score >= 70) {
    gameState.interviews[3].passed = true;
    gameState.level = Math.max(gameState.level, 4);
    renderStats();
    log(
      `"Your reactions are acceptable. You may face the final boss." (Score: ${score.toFixed(0)}%)`,
      "Interviewer"
    );
  } else {
    log(
      `"Too slow. The boss's temper is faster than you." (Score: ${score.toFixed(0)}%)`,
      "Interviewer"
    );
  }

  activeInterview = null;
  if (area) {
    area.classList.add("hidden");
    area.innerHTML = "";
  }
}

/* ---------- Interview 4: Big boss preferences (final boss) ---------- */

const FINAL_BOSS_QUESTIONS = [
  {
    q: "The big boss sets a meeting at 09:00. When do you arrive?",
    options: [
      "08:55, ready and calm.",
      "09:00 exactly.",
      "09:05, meetings always start late."
    ],
    correct: 0 // hint from bar: punctuality
  },
  {
    q: "In a meeting, a colleague starts gossiping about another team.",
    options: [
      "Join in to bond.",
      "Stay neutral and move the talk back to work.",
      "Add more gossip to the story."
    ],
    correct: 1 // hint: hates gossip
  },
  {
    q: "The boss asks a question you can answer in one short line.",
    options: [
      "Give a long story to show effort.",
      "Give a short, clear answer, then offer details if needed.",
      "Avoid answering and change the topic."
    ],
    correct: 1 // hint: short, clear answers
  },
  {
    q: "The boss shares an opinion you don't fully agree with.",
    options: [
      "Say it's wrong and argue hard.",
      "Add your view in a calm and short way.",
      "Stay silent and never speak up again."
    ],
    correct: 1 // balanced respect
  }
];

function startInterview4() {
  if (!canAttemptInterview(4)) {
    log("\"Final interview: one chance per day. Save-scumming not allowed.\"", "Big Boss");
    return;
  }
  markAttemptInterview(4);
  gameState.level = Math.max(gameState.level, 4);
  renderStats();

  const area = document.getElementById("interviewArea");
  if (!area) return;

  area.classList.remove("hidden");
  area.innerHTML = `
    <div class="overlay-card">
      <div class="overlay-header">
        <h3>Final Boss Interview</h3>
        <span class="small-note">
          The big boss listens quietly. You get no feedback on each answer.
          Trust what you learned around the city.
        </span>
      </div>
      <div id="int4-question" class="interview-question"></div>
      <div id="int4-options" class="interview-options"></div>
      <button id="int4-next" class="action-btn">Next</button>
    </div>
  `;

  logRandomDialogue("recruiter", "boss");

  activeInterview = {
    type: 4,
    index: 0,
    correct: 0,
    total: FINAL_BOSS_QUESTIONS.length
  };

  showInterview4Question();

  document.getElementById("int4-next").addEventListener("click", () => {
    handleInterview4Next();
  });
}

function showInterview4Question() {
  const qData = FINAL_BOSS_QUESTIONS[activeInterview.index];
  const qDiv = document.getElementById("int4-question");
  const optDiv = document.getElementById("int4-options");
  if (!qDiv || !optDiv) return;

  qDiv.textContent = `Q${activeInterview.index + 1}: ${qData.q}`;
  optDiv.innerHTML = "";

  qData.options.forEach((opt, idx) => {
    const id = `int4-opt-${idx}`;
    const label = document.createElement("label");
    label.innerHTML = `<input type="radio" name="int4" value="${idx}" id="${id}" /> ${opt}`;
    optDiv.appendChild(label);
  });
}

function handleInterview4Next() {
  const selected = document.querySelector('input[name="int4"]:checked');
  if (!selected) {
    log("The boss stares. \"Answer.\"", "Big Boss");
    return;
  }
  const choice = parseInt(selected.value, 10);
  const qData = FINAL_BOSS_QUESTIONS[activeInterview.index];

  // We track correctness but do not show per-question feedback
  if (choice === qData.correct) {
    activeInterview.correct++;
  }

  activeInterview.index++;
  if (activeInterview.index >= activeInterview.total) {
    finishInterview4();
  } else {
    showInterview4Question();
  }
}

function finishInterview4() {
  const score = (activeInterview.correct / activeInterview.total) * 100;
  const area = document.getElementById("interviewArea");

  if (score >= 75) {
    gameState.interviews[4].passed = true;
    gameState.level = Math.max(gameState.level, 4);
    renderStats();
    log(
      "\"Your answers are acceptable.\" He does not smile, but he does not dismiss you.",
      "Big Boss"
    );
    log(
      "You leave the room not sure of the result. The recruiter will call you later.",
      "Narrator"
    );
  } else {
    log(
      "The boss simply says, \"That is all.\" The door closes behind you. The silence crits for 9999 damage.",
      "Narrator"
    );
  }

  activeInterview = null;
  if (area) {
    area.classList.add("hidden");
    area.innerHTML = "";
  }
}
