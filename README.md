# airi-factorio

Helper for アイリ to play Factorio with you.


> [!NOTE]
>
> This project is part of the [Project アイリ (Airi)](https://github.com/moeru-ai/airi), we aim to build a LLM-driven VTuber like [Neuro-sama](https://www.youtube.com/@Neurosama) (subscribe if you didn't!) if you are interested in, please do give it a try on [live demo](https://airi.moeru.ai).

## Development

Clone the repository:

```bash
git clone https://github.com/moeru-ai/airi-factorio
```

Symlink the mods to your Factorio mod folder:

```bash
cd /path/to/airi-factorio

ln -s /path/to/airi-factorio/packages/autorio/dist /path/to/factorio/data/autorio
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
