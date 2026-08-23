ItemEvents.rightClicked('minecraft:stick', event => {
    GuiJS.open("planet_menu");
});

let currentPlanet = "earth";

GUIEvents.createUI("planet_menu", event => {
    const player = event.player;
    if (!player) return;

    const screenW = Client.window.guiScaledWidth;
    const screenH = Client.window.guiScaledHeight;
    let bgX = (screenW - 128) / 2;
    let bgY = (screenH - 64) / 2;

    event.image("kubejs:textures/gui/earth.png", bgX, bgY, 64, 64)
        .setVisible(currentPlanet === "earth");

    event.image("kubejs:textures/gui/nether.png", bgX, bgY, 64, 64)
        .setVisible(currentPlanet === "nether");

    event.image("kubejs:textures/gui/moon.png", bgX, bgY, 64, 64)
        .setVisible(currentPlanet === "moon");

    let panel = event.scrollPanel(bgX + 75, bgY, 110, 75)

    panel.addButton("Earth", 0, 0, 100, 20)
        .onClick(() => {
            currentPlanet = "earth";
            GuiJS.open("planet_menu");
        });

    panel.addButton("Nether", 0, 25, 100, 20)
        .onClick(() => {
            currentPlanet = "nether";
            GuiJS.open("planet_menu");
        });

    panel.addButton("Moon", 0, 50, 100, 20)
        .onClick(() => {
            currentPlanet = "moon";
            GuiJS.open("planet_menu");
        });

    panel.addButton("Mars", 0, 75, 100, 20)
        .onClick(() => {
            currentPlanet = "mars";
            GuiJS.open("planet_menu");
        });
});
