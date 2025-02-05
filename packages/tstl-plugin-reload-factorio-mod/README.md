# tstl-plugin-reload-factorio-mod

Hot reload Factorio mod during development.

## Usage

Add the following changes to your `tsconfig.json`.

```json5
{
  "compilerOptions": {
    "tstl": {
      "luaLibImport": "inline",
      "luaBundle": "control.lua",
      "luaBundleEntry": "./control.ts",
      "buildMode": "default"
    }
  }
}
```

This will bundle all the files into a single file, to help the plugin to reload the mod, because `require` is not supported outside the `control.lua` when we use `load` to reload the mod.

Set

## Development

Build the example mod, it will also build the plugin.

```bash
pnpm example:build
```

Link the example mod to the factorio mod folder.

```bash
ln -s $(pwd)/example/dist /path/to/factorio/mods/example
```

Create a save file for the example mod.

```bash
/path/to/factorio --create example.zip
```

Start the server with rcon enabled.

```bash
/path/to/factorio --start-server example.zip --rcon-port 27015 --rcon-password "123456"
```

Start [rcon api server](https://github.com/nekomeowww/factorio-rcon-api).

```bash
docker run \
  --rm \
  -e FACTORIO_RCON_HOST=<factorio-server-ip> \
  -e FACTORIO_RCON_PORT=27015 \
  -e FACTORIO_RCON_PASSWORD=123456 \
  -p 24180:24180 \
  ghcr.io/nekomeowww/factorio-rcon-api:unstable
```

Run `tstl` in watch mode.

```bash
pnpm example:dev
```

Now you can modify the example mod and see the changes immediately. When the mod is reloaded, the server will send a message to all players.

```text
[tstl-plugin-reload-factorio-mod] Mod reloaded: example
```

After you change the plugin code, you need to stop the `tstl` process and run it again.

## TODO

- [ ] Use `rcon-ts` to replace `factorio-rcon-api-client` for less dependencies.
