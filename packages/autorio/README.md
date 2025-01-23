# autorio.ts

## Example

To make a burner inserter, we need to:

```text
/c remote.call("autorio_tasks", "walk_to_entity", "coal", 500); -- walk to coal
remote.call("autorio_tasks", "mine_entity", "coal"); -- mine coal
remote.call("autorio_tasks", "walk_to_entity", "iron-ore", 500); -- walk to iron ore
remote.call("autorio_tasks", "mine_entity", "iron-ore"); -- mine iron ore
remote.call("autorio_tasks", "mine_entity", "iron-ore"); -- mine iron ore
remote.call("autorio_tasks", "mine_entity", "iron-ore"); -- mine iron ore
remote.call("autorio_tasks", "place_entity", "stone-furnace"); -- place stone furnace
remote.call("autorio_tasks", "auto_insert_nearby", "coal", "stone-furnace", 1); -- insert coal into furnace
remote.call("autorio_tasks", "auto_insert_nearby", "iron-ore", "stone-furnace", 5); -- insert iron ore into furnace

/c remote.call("autorio_tasks", "pick_up_item", "iron-plate", 5, "stone-furnace") -- pick up iron plate

/c remote.call("autorio_tasks", "craft_item", "iron-gear-wheel", 1) -- craft iron gear wheel
/c remote.call("autorio_tasks", "craft_item", "burner-inserter", 1) -- craft burner inserter

/c remote.call("autorio_tasks", "place_entity", "burner-inserter", 1) -- place burner inserter
```

<!-- ## Game compatibility -->
