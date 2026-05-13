import pygame
import random
import app.narrator as narrator
from game.constants import COLORS

# global game assets
ASSETS = {}

# Background rendering constants
BG_TILE_SIZE = 64
ARENA_SIZE = (2000, 2000)
background_surface = None

if "player_class" not in globals():
    player_class = None


def generate_background():
    """Tiles the background surface once at start-up."""
    global background_surface
    try:
        background_surface = pygame.Surface(ARENA_SIZE)
        # Placeholder with pattern (Dark Green Grass)
        grass_tile = pygame.Surface((BG_TILE_SIZE, BG_TILE_SIZE))
        grass_tile.fill((30, 80, 30))
        pygame.draw.rect(
            grass_tile, (40, 90, 40), (0, 0, BG_TILE_SIZE, BG_TILE_SIZE), 1
        )

        for y in range(0, ARENA_SIZE[1], BG_TILE_SIZE):
            for x in range(0, ARENA_SIZE[0], BG_TILE_SIZE):
                background_surface.blit(grass_tile, (x, y))
    except Exception as e:
        print(f"Background gen error: {e}")
        if background_surface:
            background_surface.fill((20, 60, 20))


def load_assets():
    """Loads game assets, ensuring pygame is initialized first."""
    global ASSETS
    try:
        ASSETS = {
            "tank": pygame.image.load("resources/tank.png").convert_alpha(),
            "scout": pygame.image.load("resources/scout.png").convert_alpha(),
            "mage": pygame.image.load("resources/mage.png").convert_alpha(),
            "lillith": pygame.image.load("resources/lillith.png").convert_alpha(),
        }
    except Exception as e:
        print(f"FAILED TO LOAD ASSETS: {e}")
        import os

        base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        try:
            ASSETS = {
                "tank": pygame.image.load(
                    os.path.join(base_path, "resources/tank.png")
                ).convert_alpha(),
                "scout": pygame.image.load(
                    os.path.join(base_path, "resources/scout.png")
                ).convert_alpha(),
                "mage": pygame.image.load(
                    os.path.join(base_path, "resources/mage.png")
                ).convert_alpha(),
                "lillith": pygame.image.load(
                    os.path.join(base_path, "resources/lillith.png")
                ).convert_alpha(),
            }
        except:
            ASSETS = {}


def clear_enemies(registry):
    """Clears dynamic entities like training orbs and spells."""
    registry.training_orbs = []
    registry.player.spells = []


def randomize_positions(registry):
    """Randomly places entities on empty tiles."""
    empty_tiles = []
    for r, row in enumerate(registry.world_map):
        for c, tile in enumerate(row):
            if tile == 0:
                empty_tiles.append(
                    (c * registry.tile_size + 50, r * registry.tile_size + 50)
                )

    if len(empty_tiles) > 5:
        random.shuffle(empty_tiles)
        registry.player.x, registry.player.y = empty_tiles.pop()
        for npc in registry.npcs:
            npc.x, npc.y = empty_tiles.pop()
        registry.villain.x, registry.villain.y = empty_tiles.pop()


def check_collision(x, y, registry):
    grid_x, grid_y = int(x // registry.tile_size), int(y // registry.tile_size)
    if 0 <= grid_y < len(registry.world_map) and 0 <= grid_x < len(
        registry.world_map[0]
    ):
        return registry.world_map[grid_y][grid_x] == 1
    return True


def draw_sprite(screen, sprite_key, x, y, size, camera_offset=(0, 0)):
    rx, ry = x - camera_offset[0], y - camera_offset[1]
    if sprite_key in ASSETS:
        img = pygame.transform.scale(ASSETS[sprite_key], (size * 2, size * 2))
        rect = img.get_rect(center=(rx, ry))
        screen.blit(img, rect)
    else:
        color = COLORS["SUPERCELL_GOLD"] if sprite_key == "mage" else (0, 150, 255)
        pygame.draw.circle(screen, color, (int(rx), int(ry)), size // 2)


def wrap_text(text, font, max_width):
    """Wraps text into multiple lines based on width."""
    words = text.split(" ")
    lines = []
    current_line = ""

    for word in words:
        test_line = current_line + word + " "
        if font.size(test_line)[0] < max_width:
            current_line = test_line
        else:
            lines.append(current_line.strip())
            current_line = word + " "
    lines.append(current_line.strip())
    return lines


def draw_ui(screen, registry):
    # stats bar
    pygame.draw.rect(screen, (20, 20, 20), (20, 20, 300, 80))
    pygame.draw.rect(screen, COLORS["SUPERCELL_GOLD"], (20, 20, 300, 80), 2)

    font = pygame.font.SysFont("Arial", 16, bold=True)
    # health
    hp_ratio = registry.player.health / registry.player.max_health
    pygame.draw.rect(screen, (255, 50, 50), (30, 35, int(200 * hp_ratio), 10))
    screen.blit(
        font.render(f"HP: {registry.player.health}", True, (255, 255, 255)), (240, 32)
    )

    # mana
    mana_ratio = registry.player.mana / 100
    pygame.draw.rect(screen, (0, 150, 255), (30, 55, int(200 * mana_ratio), 10))
    screen.blit(
        font.render(f"MANA: {int(registry.player.mana)}", True, (255, 255, 255)),
        (240, 52),
    )

    # inventory / sigils
    sigils_text = f"SIGILS: {len(registry.player.inventory)}/3"
    screen.blit(font.render(sigils_text, True, COLORS["SUPERCELL_GOLD"]), (30, 75))

    # dialogue log
    log_rect = pygame.Rect(0, 500, 800, 100)
    pygame.draw.rect(screen, (10, 10, 10), log_rect)
    pygame.draw.line(screen, COLORS["SUPERCELL_GOLD"], (0, 500), (800, 500), 3)

    font_log = pygame.font.SysFont("Consolas", 16)
    all_wrapped_lines = []
    for msg in registry.combat_log:
        wrapped = wrap_text(f"> {msg}", font_log, 760)
        all_wrapped_lines.extend(wrapped)

    # Auto-scroll to bottom if new messages added (if not already scrolling)
    if not hasattr(registry, "_last_log_len"):
        registry._last_log_len = len(all_wrapped_lines)

    if len(all_wrapped_lines) > registry._last_log_len:
        registry.log_scroll = 0
        registry._last_log_len = len(all_wrapped_lines)

    # Calculate visible lines based on scroll
    visible_lines = 4
    total_lines = len(all_wrapped_lines)

    # ensure scroll is within bounds
    max_scroll = max(0, total_lines - visible_lines)
    registry.log_scroll = max(0, min(registry.log_scroll, max_scroll))

    start_idx = total_lines - visible_lines - registry.log_scroll
    start_idx = max(0, start_idx)

    display_lines = all_wrapped_lines[start_idx : start_idx + visible_lines]

    for i, line in enumerate(display_lines):
        screen.blit(font_log.render(line, True, (200, 200, 200)), (20, 510 + i * 20))

    # recording indicator
    if registry.is_recording:
        dot_color = (
            (255, 0, 0) if (pygame.time.get_ticks() // 500) % 2 == 0 else (100, 0, 0)
        )
        pygame.draw.circle(screen, dot_color, (400, 40), 10)
        font_rec = pygame.font.SysFont("Arial", 20, bold=True)
        rec_txt = font_rec.render("VOICE RECORDING...", True, (255, 50, 50))
        screen.blit(rec_txt, (420, 30))


def draw_start_screen(screen, registry):
    """Displays the game controls and objectives."""
    overlay = pygame.Surface((800, 600), pygame.SRCALPHA)
    overlay.fill((0, 0, 0, 220))
    screen.blit(overlay, (0, 0))

    title_font = pygame.font.SysFont("Arial", 50, bold=True)
    header_font = pygame.font.SysFont("Arial", 28, bold=True)
    body_font = pygame.font.SysFont("Arial", 20)

    # Title
    title = title_font.render(
        "MISTRAL HACK: REALITY SHIFT", True, COLORS["SUPERCELL_GOLD"]
    )
    screen.blit(title, (400 - title.get_width() // 2, 80))

    # Controls
    controls_y = 180
    screen.blit(
        header_font.render("CONTROLS:", True, (255, 255, 255)), (100, controls_y)
    )
    controls = [
        "ARROW KEYS: Move your Brawler",
        "SPACEBAR: Hold to Record Voice / Toggle Mistral Refactor",
        "E KEY: Interact with NPCs / Start Training",
        "R KEY: Reset Game (on Win/Loss)",
    ]
    for i, line in enumerate(controls):
        screen.blit(
            body_font.render(line, True, (200, 200, 200)),
            (120, controls_y + 40 + i * 30),
        )

    # Goal
    goal_y = 360
    screen.blit(header_font.render("OBJECTIVE:", True, (255, 255, 255)), (100, goal_y))
    goal_lines = [
        "1. Talk to the Elder and Guard to earn Sigils.",
        "2. Find the hidden sigil using the hidden voice command.",
        "3. Once the barrier falls, defeat Lillith with Voice Spells!",
    ]
    for i, line in enumerate(goal_lines):
        screen.blit(
            body_font.render(line, True, (200, 200, 200)), (120, goal_y + 40 + i * 30)
        )

    # Start Prompt
    start_txt = header_font.render(
        "PRESS ENTER TO BEGIN YOUR QUEST", True, COLORS["SUPERCELL_GOLD"]
    )
    if (pygame.time.get_ticks() // 500) % 2 == 0:
        screen.blit(start_txt, (400 - start_txt.get_width() // 2, 520))


def update(screen, registry):
    try:
        global background_surface, player_class
        if background_surface is None:
            generate_background()

        keys = pygame.key.get_pressed()

        # Start Screen Logic
        if not registry.game_started:
            if background_surface:
                screen.blit(background_surface, (0, 0))
            else:
                screen.fill((10, 25, 10))
            draw_start_screen(screen, registry)
            if keys[pygame.K_RETURN]:
                registry.game_started = True
            return

        if not ASSETS:
            load_assets()
        if not hasattr(registry, "initialized") or not registry.initialized:
            randomize_positions(registry)
            registry.initialized = True

        keys = pygame.key.get_pressed()

        # --- DAY/NIGHT CYCLE LOGIC ---
        import math

        current_ticks = pygame.time.get_ticks()
        # offset by -pi/2 to start at sin(-pi/2) = -1 ( Noon -> darkness=0 )
        time_factor = math.sin(
            (current_ticks / registry.day_cycle_ms) * 2 * math.pi - math.pi / 2
        )
        # darkness: 0.0 (noon) to 1.0 (midnight)
        darkness = (time_factor + 1) / 2

        # Use pre-rendered background based on camera
        cam_x = registry.player.x - 400
        cam_y = registry.player.y - 300

        # arena bounds (based on map size)
        map_width = len(registry.world_map[0]) * registry.tile_size
        map_height = len(registry.world_map) * registry.tile_size
        cam_x = max(0, min(cam_x, map_width - 800))
        cam_y = max(0, min(cam_y, map_height - 600))

        # screen shake
        if registry.screen_shake > 0:
            cam_x += random.randint(-5, 5)
            cam_y += random.randint(-5, 5)
            registry.screen_shake -= 1

        if background_surface:
            screen.blit(background_surface, (-cam_x, -cam_y))
        else:
            screen.fill((10, 25, 10))

        # --- APPLY NIGHT VISUALS ---
        if darkness > 0.1:
            overlay = pygame.Surface((800, 600), pygame.SRCALPHA)
            night_color = (0, 0, 40, int(150 * darkness))
            overlay.fill(night_color)
            screen.blit(overlay, (0, 0))

        if darkness > 0.7:
            for i in range(25):
                random.seed(i * 123)
                sx = random.randint(0, 800)
                sy = random.randint(0, 500)
                star_size = random.randint(1, 3)
                alpha = int(255 * (0.5 + 0.5 * math.sin(current_ticks * 0.005 + i)))
                pygame.draw.circle(screen, (255, 255, 255, alpha), (sx, sy), star_size)
        # -----------------------------

        # draw map walls with camera (only tile == 1)
        for r, row in enumerate(registry.world_map):
            for c, tile in enumerate(row):
                if tile == 1:
                    rx, ry = (
                        c * registry.tile_size - cam_x,
                        r * registry.tile_size - cam_y,
                    )
                    pygame.draw.rect(screen, (40, 40, 40), (rx, ry, 100, 100))
                    pygame.draw.rect(screen, (80, 80, 80), (rx, ry, 100, 100), 2)

        # player movement
        speed = registry.player.speed
        old_x, old_y = registry.player.x, registry.player.y
        if keys[pygame.K_LEFT]:
            registry.player.x -= speed
        if keys[pygame.K_RIGHT]:
            registry.player.x += speed
        if check_collision(registry.player.x, registry.player.y, registry):
            registry.player.x = old_x
        if keys[pygame.K_UP]:
            registry.player.y -= speed
        if keys[pygame.K_DOWN]:
            registry.player.y += speed
        if check_collision(registry.player.x, registry.player.y, registry):
            registry.player.y = old_y

        # interactions (npcs)
        for npc in registry.npcs:
            draw_sprite(
                screen,
                npc.sprite,
                npc.x,
                npc.y,
                registry.player.size,
                (cam_x, cam_y),
            )
            dist = (
                (registry.player.x - npc.x) ** 2 + (registry.player.y - npc.y) ** 2
            ) ** 0.5
            if dist < 80:
                font_hint = pygame.font.SysFont("Arial", 14, bold=True)
                hint_txt = f"Press E to talk to {npc.name}"
                if npc.name == "Guard" and registry.training_active:
                    hint_txt = "TRAINING IN PROGRESS..."

                screen.blit(
                    font_hint.render(hint_txt, True, (255, 255, 255)),
                    (npc.x - cam_x - 60, npc.y - cam_y - 50),
                )

                if keys[pygame.K_e] and not registry.training_active:
                    msg = npc.dialogue
                    if npc.name == "Elder":
                        if "Elder Sigil" not in registry.player.inventory:
                            registry.player.inventory.append("Elder Sigil")
                            registry.lillith_barrier_strength -= 33
                            msg = "Take my Sigil. But Lillith has hidden the last one. Shout a 'Pulse of Truth' to see the veil!"
                        elif not registry.hidden_sigil_revealed:
                            msg = "Use your mana! Say 'Pulse of Truth' to reveal what is hidden in the latent space."

                    elif npc.name == "Guard":
                        if "Guard Sigil" not in registry.player.inventory:
                            registry.player.inventory.append("Guard Sigil")
                            registry.lillith_barrier_strength -= 33
                            msg = "Sigil earned. But you're slow! Let's calibrate your reflexes. (Press E again to start training)"
                        elif not registry.training_active:
                            registry.training_active = True
                            registry.training_timer = 30 * 60
                            registry.training_orbs = []
                            msg = "DODGE! Survive 30 seconds of calibration!"

                    if not registry.combat_log or msg != registry.combat_log[-1]:
                        registry.combat_log.append(f"{npc.name}: {msg}")
                        narrator.npc_dialogue(npc.name, msg)

        # reflex calibration logic
        if registry.training_active:
            registry.training_timer -= 1
            if registry.training_timer % 60 == 0:
                side = random.choice(["top", "bottom", "left", "right"])
                if side == "top":
                    ox, oy = random.randint(0, map_width), 0
                elif side == "bottom":
                    ox, oy = random.randint(0, map_width), map_height
                elif side == "left":
                    ox, oy = 0, random.randint(0, map_height)
                else:
                    ox, oy = map_width, random.randint(0, map_height)

                dx, dy = registry.player.x - ox, registry.player.y - oy
                n = max(1, (dx**2 + dy**2) ** 0.5)
                registry.training_orbs.append(
                    {"x": ox, "y": oy, "vx": (dx / n) * 4, "vy": (dy / n) * 4}
                )

            for orb in registry.training_orbs[:]:
                orb["x"] += orb["vx"]
                orb["y"] += orb["vy"]

                pygame.draw.circle(
                    screen,
                    COLORS["BRAWL_PURPLE"],
                    (int(orb["x"] - cam_x), int(orb["y"] - cam_y)),
                    10,
                )

                odist = (
                    (registry.player.x - orb["x"]) ** 2
                    + (registry.player.y - orb["y"]) ** 2
                ) ** 0.5
                if odist < 25:
                    registry.training_active = False
                    registry.combat_log.append("Guard: Calibration FAILED! Too slow.")
                    registry.training_orbs = []

                if (
                    orb["x"] < -100
                    or orb["x"] > map_width + 100
                    or orb["y"] < -100
                    or orb["y"] > map_height + 100
                ):
                    registry.training_orbs.remove(orb)

            if registry.training_timer <= 0:
                registry.training_active = False
                registry.training_sessions += 1
                registry.combat_log.append(
                    f"Guard: Calibration Success! ({registry.training_sessions}/2)"
                )
                if registry.training_sessions >= 2:
                    registry.lillith_barrier_strength -= 1
                    registry.player.can_cast_ult = True
                    dialogue = "Guard: Reflexes calibrated. You can now cast high-damage spells!"
                    narrator.npc_dialogue("Guard", dialogue)
                    registry.combat_log.append(dialogue)

        # hidden sigil logic
        if (
            registry.hidden_sigil_revealed
            and "Hidden Sigil" not in registry.player.inventory
        ):
            sx, sy = registry.hidden_sigil_pos
            pygame.draw.circle(
                screen, (255, 255, 0), (int(sx - cam_x), int(sy - cam_y)), 15
            )
            pygame.draw.circle(
                screen, (255, 255, 255), (int(sx - cam_x), int(sy - cam_y)), 20, 2
            )
            if (
                (registry.player.x - sx) ** 2 + (registry.player.y - sy) ** 2
            ) ** 0.5 < 40:
                registry.player.inventory.append("Hidden Sigil")
                registry.lillith_barrier_strength -= 33
                registry.combat_log.append(
                    "Architect: You found the Hidden Sigil! The veil is pierced."
                )

        # villain: Lillith
        draw_sprite(
            screen,
            "lillith",
            registry.villain.x,
            registry.villain.y,
            registry.villain.size,
            (cam_x, cam_y),
        )

        # barrier
        if registry.lillith_barrier_strength > 0:
            barrier_rx = registry.villain.x - cam_x
            barrier_ry = registry.villain.y - cam_y
            pygame.draw.circle(
                screen, (191, 0, 255, 120), (int(barrier_rx), int(barrier_ry)), 100, 5
            )
            font_v = pygame.font.SysFont("Arial", 14, bold=True)
            screen.blit(
                font_v.render(
                    f"BARRIER: {int(registry.lillith_barrier_strength)}%",
                    True,
                    COLORS["BRAWL_PURPLE"],
                ),
                (barrier_rx - 40, barrier_ry + 110),
            )

        else:
            # pursuit logic
            dx, dy = (
                registry.player.x - registry.villain.x,
                registry.player.y - registry.villain.y,
            )
            dist = (dx**2 + dy**2) ** 0.5
            if dist > 0:
                registry.villain.x += (
                    (dx / dist) * registry.villain.speed * registry.time_dilation
                )
                registry.villain.y += (
                    (dy / dist) * registry.villain.speed * registry.time_dilation
                )

            # contact damage
            if dist < (registry.player.size + registry.villain.size) / 2:
                registry.player.health -= 20  # damage per frame
                if pygame.time.get_ticks() % 1000 < 20:  # subtle shake on hit
                    registry.screen_shake = 5

            # dynamic spells logic
            for spell in registry.player.spells[:]:
                spell["x"] += spell.get("vx", 0)
                spell["y"] += spell.get("vy", 0)
                pygame.draw.circle(
                    screen,
                    spell.get("color", COLORS["SUPERCELL_GOLD"]),
                    (int(spell["x"] - cam_x), int(spell["y"] - cam_y)),
                    spell.get("size", 10),
                )

                spell["life"] = spell.get("life", 60) - 1
                if spell["life"] <= 0:
                    registry.player.spells.remove(spell)

                # collision with Lillith
                vdist = (
                    (spell["x"] - registry.villain.x) ** 2
                    + (spell["y"] - registry.villain.y) ** 2
                ) ** 0.5
                if vdist < 80 and registry.lillith_barrier_strength <= 0:
                    registry.combat_log.append(f"HIT! Lillith HP decreasing...")

                    voice_line = random.choice(["ouch", "damn", "ugh"])
                    narrator.npc_dialogue(registry.villain.name, voice_line)
                    registry.villain.health -= 33

                    registry.player.spells.remove(spell)

        # player
        draw_sprite(
            screen,
            registry.player.sprite,
            registry.player.x,
            registry.player.y,
            registry.player.size,
            (cam_x, cam_y),
        )

        # UI
        draw_ui(screen, registry)
        if registry.training_active:
            f_sys = pygame.font.SysFont("Arial", 24, bold=True)
            screen.blit(
                f_sys.render(
                    f"CALIBRATING: {registry.training_timer // 60}s",
                    True,
                    COLORS["BRAWL_PURPLE"],
                ),
                (350, 20),
            )

        # UI
        draw_ui(screen, registry)

        # win condition
        if registry.villain.health <= 0:
            # flashing background effect
            alpha_surface = pygame.Surface((800, 600), pygame.SRCALPHA)
            alpha_surface.fill((255, 200, 0, 150))
            screen.blit(alpha_surface, (0, 0))

            win_font = pygame.font.SysFont("Arial", 60, bold=True)
            win_text = win_font.render("YOU WIN!", True, (255, 255, 255))
            text_rect = win_text.get_rect(center=(400, 250))
            screen.blit(win_text, text_rect)

            restart_font = pygame.font.SysFont("Arial", 24)
            restart_text = restart_font.render(
                "PRESS R TO RESTART!", True, (255, 255, 255)
            )
            restart_rect = restart_text.get_rect(center=(400, 320))
            screen.blit(restart_text, restart_rect)

            # reset game on R key
            if keys[pygame.K_r]:
                clear_enemies(registry)
                registry.player.health = registry.player.max_health
                registry.player.mana = registry.player.max_mana
                registry.player.can_cast_ult = False
                registry.lillith_barrier_strength = 100.0
                registry.villain.health = registry.villain.max_health
                registry.player.inventory = []
                registry.player.x = 400
                registry.player.y = 300
                registry.needs_reload = True
                randomize_positions(registry)

        # game over
        if registry.player.health <= 0:
            # flashing background effect
            alpha_surface = pygame.Surface((800, 600), pygame.SRCALPHA)
            alpha_surface.fill((255, 50, 50, 150))
            screen.blit(alpha_surface, (0, 0))

            game_over_font = pygame.font.SysFont("Arial", 60, bold=True)
            game_over_text = game_over_font.render(
                "YOU DIED!", True, COLORS["SUPERCELL_GOLD"]
            )
            text_rect = game_over_text.get_rect(center=(400, 250))
            screen.blit(game_over_text, text_rect)

            restart_font = pygame.font.SysFont("Arial", 24)
            restart_text = restart_font.render(
                "PRESS R TO RESTART!", True, (255, 255, 255)
            )
            restart_rect = restart_text.get_rect(center=(400, 320))
            screen.blit(restart_text, restart_rect)

            # reset game on R key
            if keys[pygame.K_r]:
                clear_enemies(registry)
                registry.player.health = registry.player.max_health
                registry.player.mana = registry.player.max_mana
                registry.player.can_cast_ult = False
                registry.lillith_barrier_strength = 100.0
                registry.villain.health = registry.villain.max_health
                registry.player.inventory = []
                registry.player.x = 400
                registry.player.y = 300
                registry.needs_reload = True
                randomize_positions(registry)

    except Exception as e:
        print(f"RPG Logic Error: {e}")
