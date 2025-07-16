# Pebble VS Code Extension

This extension provides a development environment for Pebble apps and watchfaces. Rather than running commands using the `pebble` CLI, you can access those via buttons in the VSCode interface.

## Features

Run button at the top of each Pebble project file.
![Run Button](images/run-button.png)

Run it on a phone or emulator, with or without logs.
![Run Options](images/run-options.png)

Start a new watch app from the sidebar.
![Sidebar](images/sidebar.png)

Terminal-style interface in the command bar.
![Command Bar](images/command-bar.png)

Take any action from the VS Code command palette.
![Command Palette](images/command-palette.png)

## Requirements

You'll need the `pebble` command-line tool installed. If you don't have it, check out the instructions in the Pebble SDK documentation.

## Extension Settings

This extension contributes the following settings:

* `pebble.defaultPlatform`: Set the default emulator platform.
* `pebble.phoneIp`: Set the default phone IP.