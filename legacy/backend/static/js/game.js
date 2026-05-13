// Core Game Logic (Vanilla JS version)
// Side Scroller Level Data
// Interconnected Map Areas
let currentArea = 1;
const AREAS = {
	1: [
		{ x: 0, y: 700, w: 2000, h: 100, color: 0x3d251e }, // Ground only
	],
	2: [
		{ x: 0, y: 700, w: 2000, h: 100, color: 0x3d251e },
	]
};
const TILE_SIZE = 100;

let gameState = {
	health: 100,
	mana: 100,
	sigils: 0,
	barrier: 100,
	trainingActive: false,
	villainHealth: 100,
	inventory: [],
	timeCycle: 0,
	timeMultiplier: 0.0000925 // 3 minutes at 60fps
};

const SKY_COLORS = {
	day: [0x87CEEB, 0xADD8E6, 0xFFE4B5],
	night: [0x0a0a23, 0x1a1a2e, 0x16213e]
};

let scene, player, lillith, orbs, spells, interactionHint, cursors, keyE, npcs, walls, doors, platforms;
let trainingTimer = 0;
let playerSpeed = 250;

const config = {
	type: Phaser.AUTO,
	width: window.innerWidth,
	height: window.innerHeight,
	parent: 'game-container',
	physics: {
		default: 'arcade',
		arcade: {
			debug: false,
			gravity: { y: 1200 } // Stronger gravity for snappy 2D feel
		}
	},
	scene: { preload, create, update }
};

const game = new Phaser.Game(config);

function preload() {
	this.load.svg('player', '/static/assets/player.svg');
	this.load.svg('npc', '/static/assets/elder.svg');
	this.load.svg('guard', '/static/assets/guard.svg');
	this.load.svg('villain', '/static/assets/villain.svg');
	this.load.image('spell', 'https://labs.phaser.io/assets/sprites/yellow_ball.png');
	this.load.image('orb', 'https://labs.phaser.io/assets/sprites/purple_ball.png');
}

function create() {
	scene = this;
	this.physics.world.setBounds(0, 0, 2000, 800);
	this.cameras.main.setBounds(0, 0, 2000, 800);

	this.skyRects = [];
	// Create sky layers
	this.skyRects.push(this.add.rectangle(1000, 100, 2000, 200, 0x87CEEB).setScrollFactor(0.05));
	this.skyRects.push(this.add.rectangle(1000, 300, 2000, 200, 0xADD8E6).setScrollFactor(0.1));
	this.skyRects.push(this.add.rectangle(1000, 500, 2000, 200, 0xFFE4B5).setScrollFactor(0.15));

	// Star Field (hidden during day)
	this.stars = [];
	for (let i = 0; i < 100; i++) {
		const sx = Phaser.Math.Between(0, 2000);
		const sy = Phaser.Math.Between(0, 400);
		const star = this.add.circle(sx, sy, 1, 0xffffff, 0);
		star.setScrollFactor(Math.random() * 0.1);
		this.stars.push(star);
	}

	// Wispy Clouds
	for (let i = 0; i < 8; i++) {
		const cx = Phaser.Math.Between(0, 2000);
		const cy = Phaser.Math.Between(100, 400);
		const cw = Phaser.Math.Between(200, 500);
		this.add.rectangle(cx, cy, cw, 15, 0xffffff, 0.05).setScrollFactor(0.12);
	}

	// Mountain Silhouette
	this.mountains = this.add.polygon(1000, 600, "0 800 400 300 800 800 1200 400 1600 800 2000 300 2000 800", 0x0f172a).setScrollFactor(0.2);

	// Pine Trees Midground
	this.treesGroup = this.add.group();
	for (let i = 0; i < 20; i++) {
		const tx = i * 150;
		const ty = 700;
		const tree = this.add.triangle(tx, ty, 0, 100, 50, 0, 100, 100, 0x0f3460).setScrollFactor(0.4).setDepth(-1);
		this.treesGroup.add(tree);
	}
	// ----------------------------

	platforms = this.physics.add.staticGroup();
	player = this.physics.add.sprite(100, 600, 'player').setScale(2);
	player.setCollideWorldBounds(true);
	player.setGravityY(1200);

	npcs = this.physics.add.staticGroup();
	walls = this.physics.add.staticGroup();
	doors = this.physics.add.staticGroup();
	spells = this.physics.add.group();
	orbs = this.physics.add.group();

	this.physics.add.collider(player, platforms);
	this.physics.add.collider(npcs, platforms);
	this.physics.add.collider(player, walls);

	this.cameras.main.startFollow(player, true, 0.5, 0.5);
	this.cameras.main.setZoom(1.5);

	lillith = this.physics.add.sprite(1800, 650, 'villain').setScale(3); // Within world bounds
	lillith.setImmovable(true);

	interactionHint = this.add.text(0, 0, '', {
		fontFamily: '"Press Start 2P"',
		fontSize: '10px',
		fill: '#FFD700',
		stroke: '#000',
		strokeThickness: 4
	}).setOrigin(0.5).setVisible(false);

	this.physics.add.overlap(player, orbs, () => {
		if (gameState.trainingActive) {
			orbs.clear(true, true);
			gameState.trainingActive = false;
			addLog("Guard: Calibration FAILED!");
		}
	});

	this.physics.add.overlap(spells, lillith, (s) => {
		s.destroy();
		if (gameState.barrier <= 0) {
			gameState.villainHealth -= 10;
			addLog("Architect: HIT!");
		}
	});

	cursors = this.input.keyboard.createCursorKeys();
	keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

	// Space for recording
	this.input.keyboard.on('keydown-SPACE', startRecording);
	this.input.keyboard.on('keyup-SPACE', stopRecording);

	// Quest Book Listeners
	document.getElementById('quest-book-btn').onclick = () => {
		document.getElementById('quest-popup').classList.toggle('hidden');
	};
	document.getElementById('close-quest-btn').onclick = () => {
		document.getElementById('quest-popup').classList.add('hidden');
	};

	loadArea(currentArea);
	updateHUD();
}

function loadArea(areaNum, fromLeft = true) {
	platforms.clear(true, true);
	npcs.clear(true, true);
	const data = AREAS[areaNum] || AREAS[1];
	data.forEach(p => {
		const rect = scene.add.rectangle(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h, 0x3d251e);
		scene.physics.add.existing(rect, true);
		platforms.add(rect);

		scene.add.rectangle(p.x + p.w / 2, p.y + 5, p.w, 10, 0x228b22).setDepth(1);
		scene.add.rectangle(p.x + p.w / 2, p.y + p.h / 2, p.w - 4, p.h - 4).setStrokeStyle(2, 0x000000).setDepth(2);
	});

	// Position player based on where they came from
	player.x = fromLeft ? 100 : 1900;
	player.y = 600;

	if (areaNum === 1) {
		npcs.create(600, 650, 'npc').setScale(2).name = 'Elder';
	} else {
		npcs.create(300, 650, 'guard').setScale(2).name = 'Gate Guard';
	}
	addLog(`Architect: Entering Region ${areaNum}...`);
}

function update() {
	if (!player || !cursors) return;

	// Horizontal Movement
	if (cursors.left.isDown) {
		player.setVelocityX(-playerSpeed - 100);
	} else if (cursors.right.isDown) {
		player.setVelocityX(playerSpeed + 100);
	} else {
		player.setVelocityX(0);
	}

	// Jumping
	if (cursors.up.isDown && player.body.blocked.down) {
		player.setVelocityY(-650);
	}

	// Passive Mana
	if (this.time.now % 200 < 20) {
		gameState.mana = Math.min(100, gameState.mana + 1);
		updateHUD();
	}

	// Area Transitions (Bidirectional)
	if (player.x > 1950) {
		if (AREAS[currentArea + 1]) {
			currentArea++;
			loadArea(currentArea, true);
		} else {
			player.x = 1950; // Bound at end of world
		}
	} else if (player.x < 50) {
		if (AREAS[currentArea - 1]) {
			currentArea--;
			loadArea(currentArea, false);
		} else {
			player.x = 50; // Bound at start of world
		}
	}

	// NPC & Door Interaction
	let near = false;
	npcs.getChildren().forEach(npc => {
		const dist = Phaser.Math.Distance.Between(player.x, player.y, npc.x, npc.y);
		if (dist < 100) {
			near = true;
			interactionHint.setText(`Press E to talk to ${npc.name}`).setPosition(npc.x, npc.y - 60).setVisible(true);
			if (Phaser.Input.Keyboard.JustDown(keyE)) {
				handleNPC(npc);
			}
		}
	});

	doors.getChildren().forEach(door => {
		const dist = Phaser.Math.Distance.Between(player.x, player.y, door.x, door.y);
		if (dist < 80) {
			near = true;
			interactionHint.setText(`Press E to open door`).setPosition(door.x, door.y - 60).setVisible(true);
			if (Phaser.Input.Keyboard.JustDown(keyE)) {
				addLog("Architect: This door leads to another layer of reality... but it's locked for now.");
			}
		}
	});
	if (!near) interactionHint.setVisible(false);

	// Lillith Pursuit
	if (gameState.barrier <= 0 && gameState.villainHealth > 0) {
		this.physics.moveToObject(lillith, player, 150);
		if (Phaser.Math.Distance.Between(player.x, player.y, lillith.x, lillith.y) < 60) {
			gameState.health -= 0.5;
			updateHUD();
		}
	}

	try {
		updateEnvironment();
	} catch (e) {
		console.error("Env Update Error:", e);
	}
}

function updateEnvironment() {
	gameState.timeCycle += gameState.timeMultiplier;
	if (gameState.timeCycle > 1.0) gameState.timeCycle = 0;

	// Oscillation: 0 (Day) -> 1 (Night) -> 0 (Day)
	// Offset by -PI/2 to start at Noon
	const t = (Math.sin(gameState.timeCycle * Math.PI * 2 - Math.PI / 2) + 1) / 2;

	// Game Clock Update
	const totalMinutes = gameState.timeCycle * 24 * 60;
	const displayMinutes = Math.floor((totalMinutes + 12 * 60) % (24 * 60));
	const hours = Math.floor(displayMinutes / 60);
	const mins = displayMinutes % 60;
	const timeStr = `TIME: ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
	const clockEl = document.getElementById('game-clock');
	if (clockEl) clockEl.innerText = timeStr;

	// Update Sky Colors
	scene.skyRects.forEach((rect, i) => {
		const dayColor = Phaser.Display.Color.ValueToColor(SKY_COLORS.day[i]);
		const nightColor = Phaser.Display.Color.ValueToColor(SKY_COLORS.night[i]);
		const lerped = Phaser.Display.Color.Interpolate.ColorWithColor(dayColor, nightColor, 100, t * 100);
		rect.setFillStyle(Phaser.Display.Color.GetColor(lerped.r, lerped.g, lerped.b));
	});

	// Update Star Alpha
	const starAlpha = Math.max(0, (t - 0.5) * 2);
	scene.stars.forEach(star => star.setAlpha(starAlpha * Math.random()));

	// Style Mountains and Trees (Shapes use setFillStyle, not setTint)
	const tintValue = Phaser.Display.Color.Interpolate.ColorWithColor(
		Phaser.Display.Color.ValueToColor(0xffffff),
		Phaser.Display.Color.ValueToColor(0x222222),
		100, t * 100
	);
	const tintHex = Phaser.Display.Color.GetColor(tintValue.r, tintValue.g, tintValue.b);

	// Mountains (Polygon)
	if (scene.mountains) scene.mountains.setFillStyle(Phaser.Display.Color.GetColor(
		Math.floor(0x0f * (1 - t) + 0x05 * t),
		Math.floor(0x17 * (1 - t) + 0x05 * t),
		Math.floor(0x2a * (1 - t) + 0x05 * t)
	));

	// Trees (Triangles)
	if (scene.treesGroup) {
		scene.treesGroup.getChildren().forEach(tree => {
			tree.setFillStyle(Phaser.Display.Color.GetColor(
				Math.floor(0x0f * (1 - t) + 0x05 * t),
				Math.floor(0x34 * (1 - t) + 0x05 * t),
				Math.floor(0x60 * (1 - t) + 0x10 * t)
			));
		});
	}
}

function handleNPC(npc) {
	const dialogs = {
		'Village Chief': "Chief: Our reality is shifting, Brawler. The Architect is listening.",
		'Blacksmith': "Smith: I can't forge logic-sparks yet. Ask the Architect for a weapon.",
		'Villager Tim': "Tim: Have you seen the Hidden Sigil? I lost it near the forest.",
		'Villager Sue': "Sue: It's a nice day for a reality shift, isn't it?",
		'Gate Guard': "Guard: Beyond these walls lies only code. Be careful."
	};

	if (dialogs[npc.name]) {
		addLog(dialogs[npc.name]);
	} else {
		addLog(`${npc.name}: Move along.`);
	}
	updateHUD();
}

// HUD and Logging
function updateHUD() {
	document.getElementById('health-bar').style.height = `${gameState.health}%`;
	document.getElementById('mana-bar').style.height = `${gameState.mana}%`;
	document.getElementById('barrier-bar').style.width = `${gameState.barrier}%`;
	document.getElementById('barrier-text').innerText = `${Math.max(0, Math.floor(gameState.barrier))}%`;
	document.getElementById('sigils').innerText = `SIGILS: ${gameState.sigils}/3`;
}

function addLog(msg) {
	const log = document.getElementById('combat-log');
	const entry = document.createElement('div');
	entry.className = 'log-entry';
	entry.innerText = `> ${msg}`;
	log.appendChild(entry);
	log.scrollTop = log.scrollHeight;
}

// Logic Injection
function shiftReality(result) {
	try {
		const data = JSON.parse(result.code.replace(/```json\n?|```/g, "").trim());
		addLog(`Architect: ${data.dialogue}`);
		if (data.jsCode) {
			console.log("Injecting Logic:", data.jsCode);
			// Execute the JS code in a context where 'scene', 'player', etc. are available
			(new Function('scene', 'player', 'lillith', 'npcs', 'orbs', 'spells', 'platforms', 'gameState', 'addLog', data.jsCode))(
				scene, player, lillith, npcs, orbs, spells, platforms, gameState, addLog
			);
		}
	} catch (e) {
		console.error("Shift Error:", e);
		addLog("Architect: Reality is fracturing...");
	}
}

// Recording Logic
let mediaRecorder;
let audioChunks = [];

async function startRecording() {
	if (gameState.mana < 10) {
		addLog("Architect: Insufficient mana.");
		return;
	}
	gameState.mana -= 10;
	updateHUD();

	document.getElementById('recording-indicator').classList.remove('hidden');
	const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	mediaRecorder = new MediaRecorder(stream);
	audioChunks = [];
	mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
	mediaRecorder.onstop = async () => {
		const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
		const formData = new FormData();
		formData.append('file', audioBlob);

		addLog("Architect: Processing whisper...");
		const transRes = await fetch('/transcribe', { method: 'POST', body: formData });
		const transData = await transRes.json();

		if (transData.text) {
			addLog(`You: ${transData.text}`);
			const vibeRes = await fetch('/vibe-shift', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_intent: transData.text })
			});
			const vibeData = await vibeRes.json();
			shiftReality(vibeData);
		}
	};
	mediaRecorder.start();
}

function stopRecording() {
	if (mediaRecorder && mediaRecorder.state === 'recording') {
		mediaRecorder.stop();
		document.getElementById('recording-indicator').classList.add('hidden');
	}
}

// Window Resize Handling
window.addEventListener('resize', () => {
	game.scale.resize(window.innerWidth, window.innerHeight);
});
