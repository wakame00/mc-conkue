ItemEvents.rightClicked('kubejs:operation_map', event => {
  GuiJS.open('conquest_operations_map')
})

function conqGuiCommand(command) {
  Client.player.command(command)
  GuiJS.close()
}

GUIEvents.createUI('conquest_operations_map', event => {
  const screenW = Client.window.guiScaledWidth
  const screenH = Client.window.guiScaledHeight
  const left = Math.floor((screenW - 360) / 2)
  const top = Math.floor((screenH - 240) / 2)

  event.setTitle('\u4f5c\u6226\u30de\u30c3\u30d7')
  event.background(true)
  event.label('\u4f5c\u6226\u30de\u30c3\u30d7 - \u30ea\u30b9\u30dd\u30fc\u30f3\u5730\u70b9\u30fb\u5175\u79d1\u9078\u629e', left + 58, top + 8, 0xFFD700)
  event.label('\u62e0\u70b9\u306f\u81ea\u8ecd\u304c\u5360\u9818\u4e2d\u306e\u5834\u5408\u306e\u307f\u9078\u629e\u3067\u304d\u307e\u3059', left + 72, top + 24, 0xC0C0C0)

  event.label('\u30ea\u30b9\u30dd\u30fc\u30f3\u5730\u70b9', left + 20, top + 48, 0xFFFFFF)
  event.button('\u672c\u62e0\u5730', left + 30, top + 125, 82, 20)
    .addTooltip('\u672c\u62e0\u5730\u306e\u8907\u6570\u5730\u70b9\u304b\u3089\u30e9\u30f3\u30c0\u30e0\u306b\u30ea\u30b9\u30dd\u30fc\u30f3\u3057\u307e\u3059', 'gray')
    .onClick(() => conqGuiCommand('conq spawn base'))
  event.button('\u62e0\u70b9 A', left + 118, top + 72, 62, 20)
    .addTooltip('\u81ea\u8ecd\u304c\u5360\u9818\u4e2d\u306a\u3089\u9078\u629e\u3067\u304d\u307e\u3059', 'gray')
    .onClick(() => conqGuiCommand('conq spawn a'))
  event.button('\u62e0\u70b9 B', left + 164, top + 118, 62, 20)
    .addTooltip('\u81ea\u8ecd\u304c\u5360\u9818\u4e2d\u306a\u3089\u9078\u629e\u3067\u304d\u307e\u3059', 'gray')
    .onClick(() => conqGuiCommand('conq spawn b'))
  event.button('\u62e0\u70b9 C', left + 212, top + 95, 62, 20)
    .addTooltip('\u81ea\u8ecd\u304c\u5360\u9818\u4e2d\u306a\u3089\u9078\u629e\u3067\u304d\u307e\u3059', 'gray')
    .onClick(() => conqGuiCommand('conq spawn c'))
  event.button('\u62e0\u70b9 D', left + 252, top + 142, 62, 20)
    .addTooltip('\u81ea\u8ecd\u304c\u5360\u9818\u4e2d\u306a\u3089\u9078\u629e\u3067\u304d\u307e\u3059', 'gray')
    .onClick(() => conqGuiCommand('conq spawn d'))
  event.button('\u62e0\u70b9 E', left + 292, top + 82, 62, 20)
    .addTooltip('\u81ea\u8ecd\u304c\u5360\u9818\u4e2d\u306a\u3089\u9078\u629e\u3067\u304d\u307e\u3059', 'gray')
    .onClick(() => conqGuiCommand('conq spawn e'))

  event.label('\u5175\u79d1\u9078\u629e (\u9078\u629e\u5f8c\u3059\u3050\u652f\u7d66\u30fb\u8a66\u5408\u4e2d\u3082\u5909\u66f4\u53ef)', left + 20, top + 176, 0xFFFFFF)
  event.button('\u7a81\u6483\u5175', left + 20, top + 196, 75, 20)
    .addTooltip('M4A1 / 5.56mm', 'gray')
    .onClick(() => conqGuiCommand('conq kit assault'))
  event.button('\u5075\u5bdf\u5175', left + 105, top + 196, 75, 20)
    .addTooltip('AWP / Glock 17', 'gray')
    .onClick(() => conqGuiCommand('conq kit scout'))
  event.button('\u5bfe\u6226\u8eca\u5175', left + 190, top + 196, 75, 20)
    .addTooltip('RPG-7 / UMP45', 'gray')
    .onClick(() => conqGuiCommand('conq kit at'))
  event.button('\u885b\u751f\u5175', left + 275, top + 196, 75, 20)
    .addTooltip('UMP45 / \u533b\u7642\u30ad\u30c3\u30c8', 'gray')
    .onClick(() => conqGuiCommand('conq kit medic'))
})
