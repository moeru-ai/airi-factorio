# Factorio Service (MCP Bridge)

A Model Context Protocol (MCP) server that provides a direct RCON bridge for the AIRI Desktop application. 
This bypasses the need for external REST API wrappers, allowing the LLM to directly execute read-only Lua commands to check factory states, player positions, and inventory.

## Features
- Direct RCON connection via `rcon-client`.
- Standardized MCP tool `factorio_execute_rcon`.
- Built-in command limits to prevent LLM spatial hallucinations (e.g., overlapping entity placements).

## Usage
Add this service to your Desktop AIRI `mcp.json` configuration file. See the main repository README for the exact JSON structure.