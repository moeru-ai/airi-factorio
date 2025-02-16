# airi-factorio

Helper for アイリ to play Factorio with you.

> [!NOTE]
>
> This project is part of the [Project アイリ (Airi)](https://github.com/moeru-ai/airi), we aim to build a LLM-driven VTuber like [Neuro-sama](https://www.youtube.com/@Neurosama) (subscribe if you didn't!), if you are interested in, please do give it a try on [live demo](https://airi.moeru.ai).

## Development

### Project Structure

It's hard to describe the project structure in a few words, but it currently looks like this:

<div style="max-width: 500px; margin: 0 auto;">

![project-structure](./project-structure.png)

</div>

### Start to develop

1. Clone the repository:

    ```bash
    git clone https://github.com/moeru-ai/airi-factorio
    ```

2. Install dependencies:

    ```bash
    pnpm i
    ```

3. Create a symlink for the `autorio` mod:

    ```bash
    cd /path/to/airi-factorio

    ln -s /path/to/airi-factorio/packages/autorio/dist /path/to/factorio/data/autorio
    # If you are using DevContainer, you can use the following command:
    ln -s /workspace/airi-factorio/packages/autorio/dist /opt/factorio/data/autorio
    ```

4. Copy and fill the `.env` file:

    ```bash
    cp packages/agent/.env.example packages/agent/.env.local
    cp packages/factorio-wrapper/.env.example packages/factorio-wrapper/.env.local
    ```

    If you are using DevContainer, you can set `WS_SERVER_HOST` and `FACTORIO_WS_HOST` and `RCON_API_SERVER_HOST` to `localhost`.

5. Create a game save file, the save file path should be the same as the one in the `.env` file:

    ```bash
    /path/to/factorio/bin/x64/factorio --create /path/to/factorio/saves/save.zip
    # If you are using DevContainer, you can use the following command:
    /opt/factorio/bin/x64/factorio --create /path/to/factorio/saves/save.zip
    # If your machine is not x64, you can use the following command:
    box64 /opt/factorio/bin/x64/factorio --create /path/to/factorio/saves/save.zip
    ```

6. Run the development script:

    ```bash
    pnpm run dev
    ```

Now you can use the commands in Factorio, the script will be compiled automatically, but you need to exit and re-enter the game to see the changes(no need to restart the game).

## Credits

Thanks for the original idea and code: https://github.com/naklecha/factorio-automation
