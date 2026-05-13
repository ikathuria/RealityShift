import random


class Character:
    def __init__(
        self,
        name,
        x,
        y,
        size,
        sprite,
        health=100,
        max_health=100,
        speed=0.0,
        dialogue="",
    ):
        self.name = name
        self.x = x
        self.y = y
        self.size = size
        self.sprite = sprite
        self.health = health
        self.max_health = max_health
        self.speed = speed
        self.dialogue = dialogue


class Player(Character):
    def __init__(
        self,
        name,
        x,
        y,
        size,
        sprite,
        health=100,
        max_health=100,
        speed=0.0,
        dialogue="",
    ):
        super().__init__(name, x, y, size, sprite, health, max_health, speed, dialogue)
        self.inventory = []
        self.mana = 100
        self.max_mana = 100
        self.can_cast_ult = False
        self.spells = []  # active spells


class GlobalRegistry:
    """
    Architectural Mod: A persistent state container that survives
    hot-reloading of the game_logic module.
    """

    def __init__(self):
        self.game_started = False
        self.needs_reload = False
        self.log_scroll = 0
        # narrative log
        self.is_recording = False
        self.log = [
            "Welcome to the Reality-Shift RPG. Press SPACE to whisper to the Architect."
        ]
        self.combat_log = self.log  # Keep for backward compatibility

        # day/night cycle
        self.day_cycle_ms = 180000  # 3 minutes

        # quest & state extensions
        self.quest_stage = 0

        # architect's sight
        self.hidden_sigil_revealed = False
        self.hidden_sigil_pos = (random.randint(100, 1400), random.randint(100, 900))

        # player state
        self.player = Player(
            name="Player",
            x=400,
            y=300,
            size=40,
            sprite="scout",
            health=100,
            max_health=100,
            speed=5.0,
        )

        # npc state
        self.npcs = [
            Character(
                name="Elder",
                x=200,
                y=200,
                size=40,
                sprite="mage",
                health=100,
                max_health=100,
                dialogue="Find the three Sigils of Truth to weaken her shield.",
            ),
            Character(
                name="Guard",
                x=600,
                y=400,
                size=40,
                sprite="tank",
                health=100,
                max_health=100,
                dialogue="Train hard. Lillith's barrier is no joke.",
            ),
        ]

        # reflex calibration (guard's mini-game)
        self.training_active = False
        self.training_timer = 0
        self.training_orbs = []
        self.training_sessions = 0

        # antagonist state
        self.villain = Character(
            name="Lillith",
            x=1200,
            y=500,
            size=60,
            sprite="lillith",
            health=99,
            max_health=99,
            speed=2.5,
        )
        self.lillith_barrier_strength = 100

        # world state
        self.world_map = [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ]
        self.tile_size = 100

        # visual fx
        self.time_dilation = 1.0
        self.screen_shake = 0
        self.pops = []


# Supercell Official Palette (Brawl Stars Inspired)
COLORS = {
    "SUPERCELL_GOLD": (255, 200, 0),
    "BRAWL_PURPLE": (191, 0, 255),
    "ARENA_GREEN": (20, 80, 20),
    "TROPHY_RED": (255, 50, 50),
    "EL_PRIMO_BLUE": (0, 150, 255),
}
