# Autorio

A Factorio mod that allows players to automate their tasks.

## Example

To make a burner inserter, we need to:

```text
/c remote.call("autorio_tasks", "walk_to_entity", "coal", 500) -- walk to coal
/c remote.call("autorio_tasks", "mine_entity", "coal") -- mine coal

/c remote.call("autorio_tasks", "walk_to_entity", "iron-ore", 500) -- walk to iron ore
/c remote.call("autorio_tasks", "mine_entity", "iron-ore")
/c remote.call("autorio_tasks", "mine_entity", "iron-ore")
/c remote.call("autorio_tasks", "mine_entity", "iron-ore")

/c remote.call("autorio_tasks", "auto_insert_nearby", "coal", "stone-furnace", 1) -- insert coal into furnace
/c remote.call("autorio_tasks", "auto_insert_nearby", "iron-ore", "stone-furnace", 5) -- insert iron ore into furnace

/c remote.call("autorio_tasks", "pick_up_item", "iron-plate", 5, "stone-furnace") -- pick up iron plate

/c remote.call("autorio_tasks", "craft_item", "iron-gear-wheel", 1) -- craft iron gear wheel
/c remote.call("autorio_tasks", "craft_item", "burner-inserter", 1) -- craft burner inserter

/c remote.call("autorio_tasks", "place_entity", "burner-inserter", 1) -- place burner inserter
```

<!-- ## Game compatibility -->

## Development

Go to your Factorio mod folder:

```bash
cd /path/to/factorio/data
```

Clone the repository:

```bash
git clone https://github.com/LemonNekoGH/autorio.ts autorio && cd autorio
```

Install dependencies:

```bash
pnpm i
```

Run the script:

```bash
pnpm run dev
```

Now you can use the commands in Factorio, the script will be compiled automatically, but you need to exit and re-enter the game to see the changes(no need to restart the game).

## Credits

Thanks for the original idea and code: https://github.com/naklecha/factorio-automation
