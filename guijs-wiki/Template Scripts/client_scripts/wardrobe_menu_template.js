ItemEvents.rightClicked('minecraft:apple', event => {
    GuiJS.open("wardrobe_menu");
});

GUIEvents.createUI("wardrobe_menu", event => {
    const screenW = Client.window.guiScaledWidth;
    const screenH = Client.window.guiScaledHeight;
    let bgX = (screenW - 128) / 2;
    let bgY = (screenH - 64) / 2;

    let myWardrobe = event.addWardrobe(bgX - 85, bgY - 50, 300, 200);

    myWardrobe.addDisplay(Client.player);
    myWardrobe.addDisplay(Client.player);
    myWardrobe.addDisplay(Client.player);
    myWardrobe.addDisplay(Client.player);
    myWardrobe.addDisplay(Client.player);

    let nameInput = event.textBox(bgX - 10, bgY - 30, 150, 20);

    let savedSkins = GuiJSNetwork.getSavedSkins(Client.player.uuid);
    for (let i = 0; i < savedSkins.size(); i++) {
        let savedName = savedSkins.get(i);
        if (savedName && savedName !== "") {
            GuiJSNetwork.updateSkin(myWardrobe, savedName, i);
        }
    }

    event.button("Save User Appearance", bgX - 5, bgY - 5, 140, 20)
        .onClick(() => {
            let name = nameInput.getValue();
            let currentIndex = myWardrobe.getFocusedIndex();

            if (name && name.trim() !== "") {
                GuiJSNetwork.updateSkin(myWardrobe, name, currentIndex);
            }
        });

    event.button("Apply User Appearance", bgX - 5, bgY + 95, 140, 20)
        .onClick(() => {
            let selectedSkin = myWardrobe.getFocusedUsername();

            if (selectedSkin !== "") {
                Client.player.tell("Selected and Used " + selectedSkin)
            }
        })
});
