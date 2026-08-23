// MAIKURA CONQUEST - superflat prototype for Minecraft 1.20.1 Forge / KubeJS 6
//
// Commands:
//   /conq join red|blue       - join a faction
//   /conq randomize           - randomly balance online players (operator only)
//   /conq kit <class>         - choose a class kit (assault/scout/at/medic)
//   /conq spawn <base|a-e>    - choose the next respawn location
//   /conq start|reset|stop    - operator controls
//   /conq status              - show current state
//
// Later, replace only the coordinates in FLAGS and BASES for MAIKURA CITY.

const CONQUEST = {
  startingTickets: 300,
  captureRadius: 16,
  captureSeconds: 12,
  scoreIntervalTicks: 100, // 5 seconds
  normalMaxHealth: 40,
  vehicleRespawnTicks: 20 * 90,
  lobby: { dimension: 'conq:lobby', x: 0, y: 65, z: -10 },
  overworldExit: { x: 0, y: 66, z: -16 },
  bases: {
    red: { x: -128, y: 65, z: 0 },
    blue: { x: 128, y: 65, z: 0 }
  },
  // 本拠地のリスポーン候補。戦車の進路・真横を避けつつ、前線寄りと後方に分散する。
  baseSpawnAnchors: {
    red: [
      { x: -146, y: 65, z: -22 }, { x: -146, y: 65, z: 22 },
      { x: -100, y: 65, z: -18 }, { x: -100, y: 65, z: 18 }
    ],
    blue: [
      { x: 146, y: 65, z: -22 }, { x: 146, y: 65, z: 22 },
      { x: 100, y: 65, z: -18 }, { x: 100, y: 65, z: 18 }
    ]
  },
  flags: [
    { id: 'A', x: -64, y: 65, z: -64 },
    { id: 'B', x: -32, y: 65, z: 48 },
    { id: 'C', x: 0, y: 65, z: 0 },
    { id: 'D', x: 32, y: 65, z: -48 },
    { id: 'E', x: 64, y: 65, z: 64 }
  ]
}

const KITS = {
  assault: {
    label: '突撃兵',
    gun: 'tacz:m4a1', ammo: 'tacz:556x45', ammoCount: 180,
    extra: []
  },
  scout: {
    label: '偵察兵',
    gun: 'tacz:ai_awp', ammo: 'tacz:338', ammoCount: 30,
    extra: ['tacz:modern_kinetic_gun{GunId:"tacz:glock_17"} 1', 'tacz:ammo{AmmoId:"tacz:9mm"} 60']
  },
  at: {
    label: '対戦車兵',
    gun: 'tacz:rpg7', ammo: 'tacz:rpg_rocket', ammoCount: 4,
    extra: ['tacz:modern_kinetic_gun{GunId:"tacz:ump45"} 1', 'tacz:ammo{AmmoId:"tacz:45acp"} 90']
  },
  medic: {
    label: '衛生兵',
    gun: 'tacz:ump45', ammo: 'tacz:45acp', ammoCount: 180,
    extra: ['superbwarfare:medical_kit 4']
  }
}

const VEHICLES = {
  red: { x: -112, y: 65, z: 0, entity: 'superbwarfare:m_1a_2' },
  blue: { x: 112, y: 65, z: 0, entity: 'superbwarfare:m_1a_2' }
}

// FTB Chunks shows long-range locations to FTB Teams allies. Keep these
// server teams in sync with the Conquest red/blue teams.
const FTB_CONQUEST_TEAMS = {
  red: 'CONQ_RED',
  blue: 'CONQ_BLUE'
}

let FTBTeamManagerImpl = null
let FTBTeamRank = null
let FTBColor4I = null

try {
  FTBTeamManagerImpl = Java.loadClass('dev.ftb.mods.ftbteams.data.TeamManagerImpl')
  FTBTeamRank = Java.loadClass('dev.ftb.mods.ftbteams.api.TeamRank')
  FTBColor4I = Java.loadClass('dev.ftb.mods.ftblibrary.icon.Color4I')
} catch (error) {
  console.error(`[Conquest] FTB Teams integration unavailable: ${error}`)
}

let state = {
  active: false,
  finished: false,
  ticks: 0,
  redTickets: CONQUEST.startingTickets,
  blueTickets: CONQUEST.startingTickets,
  flags: {}
}

function command(server, text) {
  server.runCommandSilent(text)
}

function tellAll(server, text) {
  server.players.forEach(player => player.tell(text))
}

function teamOf(player) {
  if (player.tags.contains('conq_red')) return 'red'
  if (player.tags.contains('conq_blue')) return 'blue'
  return null
}

function teamName(team) {
  return team === 'red' ? 'RED' : 'BLUE'
}

function teamColor(team) {
  return team === 'red' ? 'red' : 'blue'
}

function getOrCreateFtbConquestTeam(server, team) {
  if (!FTBTeamManagerImpl) return null
  const manager = FTBTeamManagerImpl.INSTANCE
  const name = FTB_CONQUEST_TEAMS[team]
  let result = manager.getTeamByName(name)
  if (result.isPresent()) return result.get()
  const color = team === 'red' ? FTBColor4I.RED : FTBColor4I.BLUE
  return manager.createServerTeam(server.createCommandSourceStack(), name, `Conquest ${team}`, color)
}

function syncFtbConquestTeam(player, team) {
  if (!FTBTeamManagerImpl) return
  try {
    const manager = FTBTeamManagerImpl.INSTANCE
    const target = getOrCreateFtbConquestTeam(player.server, team)
    const personalTeam = manager.getPersonalTeamForPlayerID(player.uuid)
    const current = personalTeam.getEffectiveTeam()

    if (current !== target && current && current.isServerTeam() && Object.values(FTB_CONQUEST_TEAMS).includes(current.getShortName())) {
      current.removeMember(player.uuid)
      current.markDirty()
    }

    target.addMember(player.uuid, FTBTeamRank.MEMBER)
    personalTeam.setEffectiveTeam(target)
    target.markDirty()
    personalTeam.markDirty()
    manager.markDirty()
    manager.syncToAll(target, personalTeam)
  } catch (error) {
    console.error(`[Conquest] Failed to sync ${player.username} to FTB team: ${error}`)
  }
}

function setupFtbConquestTeams(server) {
  if (!FTBTeamManagerImpl) return
  try {
    getOrCreateFtbConquestTeam(server, 'red')
    getOrCreateFtbConquestTeam(server, 'blue')
    server.players.forEach(player => {
      const team = teamOf(player)
      if (team) syncFtbConquestTeam(player, team)
    })
  } catch (error) {
    console.error(`[Conquest] Failed to set up FTB teams: ${error}`)
  }
}

function resetFlags(server) {
  state.flags = {}
  CONQUEST.flags.forEach(flag => {
    state.flags[flag.id] = { owner: null, progress: 0 }
    command(server, `setblock ${flag.x} ${flag.y - 1} ${flag.z} smooth_stone`)
    command(server, `setblock ${flag.x} ${flag.y} ${flag.z} white_wool`)
  })
}

function resetRound(server) {
  state.active = false
  state.finished = false
  state.ticks = 0
  state.redTickets = CONQUEST.startingTickets
  state.blueTickets = CONQUEST.startingTickets
  resetFlags(server)
  command(server, 'scoreboard objectives add conq_tickets dummy')
  command(server, 'scoreboard objectives add conq_kills dummy')
  command(server, 'scoreboard objectives add conq_deaths dummy')
  command(server, 'scoreboard objectives add conq_vehicle_timer dummy')
  command(server, `scoreboard players set RED conq_tickets ${CONQUEST.startingTickets}`)
  command(server, `scoreboard players set BLUE conq_tickets ${CONQUEST.startingTickets}`)
  command(server, 'scoreboard players set RED conq_vehicle_timer 0')
  command(server, 'scoreboard players set BLUE conq_vehicle_timer 0')
  removeTeamVehicles(server)
  server.players.forEach(player => {
    command(server, `tag ${player.username} remove conq_spawn_base`)
    CONQUEST.flags.forEach(flag => command(server, `tag ${player.username} remove conq_spawn_${flag.id.toLowerCase()}`))
  })
  tellAll(server, Text.gold('コンクエストをリセットしました。/conq join red または /conq join blue で陣営を選択。'))
}

function enoughPlayers(server) {
  let red = 0
  let blue = 0
  server.players.forEach(player => {
    if (teamOf(player) === 'red') red++
    if (teamOf(player) === 'blue') blue++
  })
  return red > 0 && blue > 0
}

function startRound(server) {
  if (state.finished || state.active || !enoughPlayers(server)) return
  state.active = true
  server.players.forEach(player => {
    if (teamOf(player)) {
      syncFtbConquestTeam(player, teamOf(player))
      setNormalHealth(player)
      const spawn = randomBaseSpawn(teamOf(player))
      teleportToBattlefield(player, spawn)
    }
    else makeSpectator(player)
  })
  spawnTeamVehicles(server)
  tellAll(server, Text.green('コンクエスト開始'))
  command(server, 'title @a title {"text":"コンクエスト","color":"gold"}')
  command(server, 'title @a subtitle {"text":"拠点を占領して敵軍チケットを削れ","color":"white"}')
}

function makeSpectator(player) {
  if (teamOf(player)) return
  const server = player.server
  command(server, `tag ${player.username} add conq_spectator`)
  command(server, `gamemode spectator ${player.username}`)
  player.tell(Text.aqua('このラウンドは観戦中です。次ラウンド開始前に陣営を選択してください。'))
}

function kitOf(player) {
  for (const kitId in KITS) {
    if (player.tags.contains(`conq_kit_${kitId}`)) return kitId
  }
  return null
}

function setNormalHealth(player) {
  command(player.server, `attribute ${player.username} minecraft:generic.max_health base set ${CONQUEST.normalMaxHealth}`)
  command(player.server, `effect give ${player.username} minecraft:instant_health 1 10 true`)
}

function giveKit(player, kitId, announce) {
  const kit = KITS[kitId]
  if (!kit) return false
  const server = player.server
  for (const otherKitId in KITS) command(server, `tag ${player.username} remove conq_kit_${otherKitId}`)
  command(server, `tag ${player.username} add conq_kit_${kitId}`)
  command(server, `clear ${player.username}`)
  command(server, `give ${player.username} tacz:modern_kinetic_gun{GunId:"${kit.gun}"} 1`)
  command(server, `give ${player.username} tacz:ammo{AmmoId:"${kit.ammo}"} ${kit.ammoCount}`)
  kit.extra.forEach(item => command(server, `give ${player.username} ${item}`))
  setNormalHealth(player)
  if (announce) player.tell(Text.green(`兵科を「${kit.label}」に変更しました。`))
  return true
}

function chooseKit(player, kitId) {
  if (!teamOf(player)) {
    player.tell(Text.red('兵科を選ぶには、先に赤軍または青軍へ参加してください。'))
    return false
  }
  return giveKit(player, kitId, true)
}

function removeTeamVehicles(server) {
  command(server, 'kill @e[type=superbwarfare:m_1a_2,tag=conq_red_tank]')
  command(server, 'kill @e[type=superbwarfare:m_1a_2,tag=conq_blue_tank]')
}

function spawnVehicle(server, team) {
  const vehicle = VEHICLES[team]
  command(server, `summon ${vehicle.entity} ${vehicle.x} ${vehicle.y} ${vehicle.z} {Tags:["conq_${team}_tank"]}`)
  command(server, `scoreboard players set ${team.toUpperCase()} conq_vehicle_timer 0`)
  tellAll(server, Text.of(`${teamName(team)}軍のM1A2が出撃しました。`).color(teamColor(team)))
}

function spawnTeamVehicles(server) {
  removeTeamVehicles(server)
  spawnVehicle(server, 'red')
  spawnVehicle(server, 'blue')
}

function updateVehicles(server) {
  for (const team of ['red', 'blue']) {
    const vehicle = VEHICLES[team]
    const scoreboardName = team.toUpperCase()
    const tag = `conq_${team}_tank`
    // Start the replacement timer only after the tagged team vehicle is gone.
    command(server, `execute unless entity @e[type=${vehicle.entity},tag=${tag},limit=1] if score ${scoreboardName} conq_vehicle_timer matches 0 run scoreboard players set ${scoreboardName} conq_vehicle_timer ${CONQUEST.vehicleRespawnTicks}`)
    command(server, `execute if score ${scoreboardName} conq_vehicle_timer matches 1.. run scoreboard players remove ${scoreboardName} conq_vehicle_timer 1`)
    command(server, `execute unless entity @e[type=${vehicle.entity},tag=${tag},limit=1] if score ${scoreboardName} conq_vehicle_timer matches 0 run summon ${vehicle.entity} ${vehicle.x} ${vehicle.y} ${vehicle.z} {Tags:["${tag}"]}`)
  }
}

function stopRound(server, winner) {
  if (!state.active) return
  state.active = false
  state.finished = true
  tellAll(server, Text.gold(`${teamName(winner)}軍が勝利しました！`))
  command(server, `title @a title {"text":"${teamName(winner)}軍 勝利","color":"${teamColor(winner)}"}`)
}

function setOwner(server, flag, owner) {
  const current = state.flags[flag.id]
  if (current.owner === owner) return
  current.owner = owner
  current.progress = 0
  const wool = owner === 'red' ? 'red_wool' : owner === 'blue' ? 'blue_wool' : 'white_wool'
  command(server, `setblock ${flag.x} ${flag.y} ${flag.z} ${wool}`)
  const ownerText = owner ? `${teamName(owner)}軍が占領` : '中立'
  tellAll(server, Text.of(`拠点 ${flag.id}：${ownerText}`).color(owner ? teamColor(owner) : 'white'))
}

function showCaptureGauge(server, flag, red, blue, attacking, progress) {
  const filled = Math.min(20, Math.floor(progress / CONQUEST.captureSeconds * 20))
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled)
  const status = red === blue
    ? `拠点 ${flag.id}　交戦中　赤 ${red} : 青 ${blue}`
    : `拠点 ${flag.id}　${teamName(attacking)}軍が占領中　赤 ${red} : 青 ${blue}　[${bar}] ${Math.min(100, Math.floor(progress / CONQUEST.captureSeconds * 100))}%`
  const color = red === blue ? 'yellow' : teamColor(attacking)
  command(server, `title @a[x=${flag.x},y=${flag.y - 8},z=${flag.z},distance=..${CONQUEST.captureRadius}] actionbar {"text":"${status}","color":"${color}"}`)
}

function updateFlag(server, flag) {
  let red = 0
  let blue = 0
  server.players.forEach(player => {
    const team = teamOf(player)
    if (!team) return
    const dx = player.x - flag.x
    const dz = player.z - flag.z
    if (dx * dx + dz * dz > CONQUEST.captureRadius * CONQUEST.captureRadius) return
    if (team === 'red') red++
    if (team === 'blue') blue++
  })

  const flagState = state.flags[flag.id]
  if (red === 0 && blue === 0) return
  if (red === blue) {
    showCaptureGauge(server, flag, red, blue, null, flagState.progress)
    return
  }

  const attacking = red > blue ? 'red' : 'blue'
  const advantage = Math.abs(red - blue)

  if (flagState.owner === attacking) {
    flagState.progress = 0
    return
  }

  flagState.progress += advantage
  showCaptureGauge(server, flag, red, blue, attacking, flagState.progress)
  if (flagState.progress >= CONQUEST.captureSeconds) {
    setOwner(server, flag, attacking)
  }
}

function ticketDrain(server) {
  let redFlags = 0
  let blueFlags = 0
  CONQUEST.flags.forEach(flag => {
    const owner = state.flags[flag.id].owner
    if (owner === 'red') redFlags++
    if (owner === 'blue') blueFlags++
  })
  if (redFlags > blueFlags) state.blueTickets -= redFlags - blueFlags
  if (blueFlags > redFlags) state.redTickets -= blueFlags - redFlags
  state.redTickets = Math.max(0, state.redTickets)
  state.blueTickets = Math.max(0, state.blueTickets)
  syncTickets(server)
  command(server, `title @a actionbar {"text":"赤軍 ${state.redTickets} チケット　|　青軍 ${state.blueTickets} チケット　|　拠点 赤:${redFlags} 青:${blueFlags}","color":"gold"}`)
  if (state.redTickets <= 0) stopRound(server, 'blue')
  if (state.blueTickets <= 0) stopRound(server, 'red')
}

function syncTickets(server) {
  command(server, `scoreboard players set RED conq_tickets ${state.redTickets}`)
  command(server, `scoreboard players set BLUE conq_tickets ${state.blueTickets}`)
}

function randomSpawnAround(center, minRadius, maxRadius) {
  const angle = Math.random() * Math.PI * 2
  const radius = minRadius + Math.random() * (maxRadius - minRadius)
  return {
    x: Math.round(center.x + Math.cos(angle) * radius),
    y: center.y + 1,
    z: Math.round(center.z + Math.sin(angle) * radius)
  }
}

function randomBaseSpawn(team) {
  const anchors = CONQUEST.baseSpawnAnchors[team]
  const anchor = anchors[Math.floor(Math.random() * anchors.length)]
  return randomSpawnAround(anchor, 2, 6)
}

function ensureLobbyPlatform(server) {
  const dimension = CONQUEST.lobby.dimension
  // The build flag is stored in the world scoreboard, so lobby construction
  // runs once and never overwrites later decoration or player changes.
  command(server, `execute unless score #CONQ_LOBBY conq_lobby_build matches 1.. run execute in ${dimension} run fill -20 63 -30 20 63 20 smooth_quartz`)
  command(server, `execute unless score #CONQ_LOBBY conq_lobby_build matches 1.. run execute in ${dimension} run fill -20 64 -30 20 64 20 smooth_quartz`)
  command(server, `execute unless score #CONQ_LOBBY conq_lobby_build matches 1.. run execute in ${dimension} run setblock ${CONQUEST.lobby.x} 64 ${CONQUEST.lobby.z} sea_lantern`)
}

function sendToLobby(player) {
  const lobby = CONQUEST.lobby
  const server = player.server
  command(server, `execute in ${lobby.dimension} run tp ${player.username} ${lobby.x} ${lobby.y} ${lobby.z}`)
  command(server, `execute in ${lobby.dimension} run spawnpoint ${player.username} ${lobby.x} ${lobby.y} ${lobby.z}`)
}

function sendToOverworld(player) {
  const team = teamOf(player)
  const target = team ? randomBaseSpawn(team) : CONQUEST.overworldExit
  const server = player.server
  // Make the selected player the command executor before changing dimension.
  // This also works when called from the lobby's command-block pressure plate.
  command(server, `execute as ${player.username} in minecraft:overworld run tp @s ${target.x} ${target.y} ${target.z}`)
  command(server, `execute as ${player.username} in minecraft:overworld run spawnpoint @s ${target.x} ${target.y} ${target.z}`)
}

function teleportToBattlefield(player, target) {
  // teleportTo(x, y, z) retains the player's current dimension. Battle coordinates
  // are in the overworld, even when this is triggered from the void lobby.
  command(player.server, `execute as ${player.username} in minecraft:overworld run tp @s ${target.x} ${target.y} ${target.z}`)
}

function placeLobbyTerminal(server, commandText, x, z) {
  const y = 65
  const trigger = `execute as @p[x=${x},y=${y + 1},z=${z},distance=..2,limit=1,sort=nearest] run ${commandText}`
  command(server, `execute unless score #CONQ_LOBBY conq_lobby_build matches 1.. run execute in ${CONQUEST.lobby.dimension} run setblock ${x} ${y} ${z} command_block{Command:"${trigger}",auto:0b,TrackOutput:0b}`)
  command(server, `execute unless score #CONQ_LOBBY conq_lobby_build matches 1.. run execute in ${CONQUEST.lobby.dimension} run setblock ${x} ${y + 1} ${z} stone_pressure_plate`)
}

function removeLegacySpawnTerminals(server) {
  const locations = CONQUEST.flags.map(flag => ({ x: flag.x + 5, y: flag.y, z: flag.z }))
  locations.push({ x: CONQUEST.bases.red.x - 10, y: CONQUEST.bases.red.y, z: CONQUEST.bases.red.z })
  locations.push({ x: CONQUEST.bases.blue.x + 10, y: CONQUEST.bases.blue.y, z: CONQUEST.bases.blue.z })
  locations.forEach(pos => {
    command(server, `execute unless score #CONQ_LEGACY_TERMINALS_REMOVED conq_lobby_build matches 1.. in minecraft:overworld if block ${pos.x} ${pos.y + 1} ${pos.z} minecraft:stone_pressure_plate run setblock ${pos.x} ${pos.y + 1} ${pos.z} air`)
    command(server, `execute unless score #CONQ_LEGACY_TERMINALS_REMOVED conq_lobby_build matches 1.. in minecraft:overworld if block ${pos.x} ${pos.y} ${pos.z} minecraft:command_block run setblock ${pos.x} ${pos.y} ${pos.z} air`)
  })
}

function setupLobby(server) {
  command(server, 'scoreboard objectives add conq_lobby_build dummy')
  ensureLobbyPlatform(server)
  placeLobbyTerminal(server, 'conq join red', -8, -2)
  placeLobbyTerminal(server, 'conq join blue', 8, -2)
  placeLobbyTerminal(server, 'conq overworld', 0, -2)
  placeLobbyTerminal(server, 'conq join random', 0, 4)
  placeLobbyTerminal(server, 'conq kit assault', -9, 10)
  placeLobbyTerminal(server, 'conq kit scout', -3, 10)
  placeLobbyTerminal(server, 'conq kit at', 3, 10)
  placeLobbyTerminal(server, 'conq kit medic', 9, 10)
  command(server, 'execute unless score #CONQ_LOBBY conq_lobby_build matches 1.. run scoreboard players set #CONQ_LOBBY conq_lobby_build 1')
  // Remove only the old test spawn terminals once; future lobby layout is manual.
  removeLegacySpawnTerminals(server)
  command(server, 'execute unless score #CONQ_LEGACY_TERMINALS_REMOVED conq_lobby_build matches 1.. run scoreboard players set #CONQ_LEGACY_TERMINALS_REMOVED conq_lobby_build 1')
}

function spawnFor(player) {
  const team = teamOf(player)
  if (!team) return null
  const selectedFlag = CONQUEST.flags.find(flag => player.tags.contains(`conq_spawn_${flag.id.toLowerCase()}`))
  if (selectedFlag && state.flags[selectedFlag.id].owner === team) {
    // 占領円（半径16）の外側へ出し、旗の真上・中心湧きを避ける。
    return randomSpawnAround(selectedFlag, 20, 28)
  }
  return randomBaseSpawn(team)
}

function chooseRespawn(player, choice) {
  const team = teamOf(player)
  if (!team) {
    player.tell(Text.red('リスポーン地点を選ぶには、先に赤軍または青軍へ参加してください。'))
    return false
  }

  const flag = choice === 'base' ? null : CONQUEST.flags.find(entry => entry.id.toLowerCase() === choice)
  if (choice !== 'base' && (!flag || state.flags[flag.id].owner !== team)) {
    player.tell(Text.red('その拠点は現在、自軍が占領していません。'))
    return false
  }

  command(player.server, `tag ${player.username} remove conq_spawn_base`)
  CONQUEST.flags.forEach(entry => command(player.server, `tag ${player.username} remove conq_spawn_${entry.id.toLowerCase()}`))
  command(player.server, `tag ${player.username} add conq_spawn_${choice}`)
  player.tell(Text.green(choice === 'base' ? 'リスポーン先：本拠地（分散配置）' : `リスポーン先：拠点 ${flag.id}（周囲に分散配置）`))
  const spawn = spawnFor(player)
  if (spawn) {
    teleportToBattlefield(player, spawn)
    player.tell(Text.aqua('選択したリスポーン地点へ移動しました。'))
  }
  return true
}

function placeSpawnTerminals(server) {
  tellAll(server, Text.gold('リスポーン端末はロビーにあります。拠点・本拠地には設置しません。'))
}

function assignTeam(player, team) {
  const server = player.server
  if (state.active) {
    player.tell(Text.red('試合中は陣営を変更できません。'))
    return false
  }
  command(server, `tag ${player.username} remove conq_red`)
  command(server, `tag ${player.username} remove conq_blue`)
  command(server, `tag ${player.username} remove conq_spectator`)
  command(server, `tag ${player.username} add conq_${team}`)
  command(server, `team join conq_${team} ${player.username}`)
  syncFtbConquestTeam(player, team)
  command(server, `gamemode creative ${player.username}`)
  setNormalHealth(player)
  player.tell(Text.of(`${teamName(team)}軍に参加しました。`).color(teamColor(team)))
  return true
}

function assignRandomTeam(player) {
  let red = 0
  let blue = 0
  player.server.players.forEach(entry => {
    if (teamOf(entry) === 'red') red++
    if (teamOf(entry) === 'blue') blue++
  })
  const team = red < blue ? 'red' : blue < red ? 'blue' : (Math.random() < 0.5 ? 'red' : 'blue')
  return assignTeam(player, team)
}

function randomizeTeams(server) {
  const players = []
  server.players.forEach(player => players.push(player))

  for (let index = players.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const swapped = players[index]
    players[index] = players[swapIndex]
    players[swapIndex] = swapped
  }

  players.forEach((player, index) => assignTeam(player, index % 2 === 0 ? 'red' : 'blue'))
  tellAll(server, Text.gold(`チームをランダム振り分け：赤軍 ${Math.ceil(players.length / 2)}人 / 青軍 ${Math.floor(players.length / 2)}人`))
}

ServerEvents.loaded(event => {
  const server = event.server
  command(server, 'team add conq_red')
  command(server, 'team add conq_blue')
  command(server, 'team modify conq_red color red')
  command(server, 'team modify conq_blue color blue')
  setupFtbConquestTeams(server)
  setupLobby(server)
  resetRound(server)
})

ServerEvents.commandRegistry(event => {
  const { commands: Commands } = event
  event.register(
    Commands.literal('conq')
      .then(Commands.literal('join')
        .then(Commands.literal('red').executes(ctx => {
          if (!ctx.source.player) return 0
          assignTeam(ctx.source.player, 'red')
          return 1
        }))
        .then(Commands.literal('blue').executes(ctx => {
          if (!ctx.source.player) return 0
          assignTeam(ctx.source.player, 'blue')
          return 1
        }))
        .then(Commands.literal('random').executes(ctx => {
          if (!ctx.source.player) return 0
          assignRandomTeam(ctx.source.player)
          return 1
        }))
      )
      .then(Commands.literal('lobby').executes(ctx => {
        if (!ctx.source.player) return 0
        if (state.active) {
          ctx.source.player.tell(Text.red('試合中はロビーへ移動できません。'))
          return 0
        }
        sendToLobby(ctx.source.player)
        ctx.source.player.tell(Text.green('ロビーへ移動しました。感圧板で陣営と兵科を選択してください。'))
        return 1
      }))
      .then(Commands.literal('overworld').executes(ctx => {
        if (!ctx.source.player) return 0
        if (state.active) {
          ctx.source.player.tell(Text.red('試合中は現世へ移動できません。'))
          return 0
        }
        sendToOverworld(ctx.source.player)
        ctx.source.player.tell(Text.green('現世へ移動しました。'))
        return 1
      }))
      .then(Commands.literal('start').requires(source => source.hasPermission(2)).executes(ctx => {
        const server = ctx.source.server
        if (!enoughPlayers(server)) {
          if (ctx.source.player) ctx.source.player.tell(Text.red('開始するには赤軍・青軍に最低1人ずつ参加してください。'))
          return 0
        }
        startRound(server)
        return 1
      }))
      .then(Commands.literal('reset').requires(source => source.hasPermission(2)).executes(ctx => {
        resetRound(ctx.source.server)
        return 1
      }))
      .then(Commands.literal('stop').requires(source => source.hasPermission(2)).executes(ctx => {
        state.active = false
        state.finished = true
        tellAll(ctx.source.server, Text.red('運営がコンクエストを停止しました。'))
        return 1
      }))
      .then(Commands.literal('randomize').requires(source => source.hasPermission(2)).executes(ctx => {
        if (state.active) {
          if (ctx.source.player) ctx.source.player.tell(Text.red('チームを振り分ける前に、試合を停止またはリセットしてください。'))
          return 0
        }
        randomizeTeams(ctx.source.server)
        return 1
      }))
      .then(Commands.literal('terminals').requires(source => source.hasPermission(2)).executes(ctx => {
        placeSpawnTerminals(ctx.source.server)
        return 1
      }))
      .then(Commands.literal('ftbteams').requires(source => source.hasPermission(2)).executes(ctx => {
        setupFtbConquestTeams(ctx.source.server)
        tellAll(ctx.source.server, Text.gold('FTB Teamsの赤軍・青軍同期を実行しました。'))
        return 1
      }))
      .then(Commands.literal('kit')
        .then(Commands.literal('assault').executes(ctx => {
          return ctx.source.player && chooseKit(ctx.source.player, 'assault') ? 1 : 0
        }))
        .then(Commands.literal('scout').executes(ctx => {
          return ctx.source.player && chooseKit(ctx.source.player, 'scout') ? 1 : 0
        }))
        .then(Commands.literal('at').executes(ctx => {
          return ctx.source.player && chooseKit(ctx.source.player, 'at') ? 1 : 0
        }))
        .then(Commands.literal('medic').executes(ctx => {
          return ctx.source.player && chooseKit(ctx.source.player, 'medic') ? 1 : 0
        }))
      )
      .then(Commands.literal('spawn')
        .then(Commands.literal('base').executes(ctx => {
          return ctx.source.player && chooseRespawn(ctx.source.player, 'base') ? 1 : 0
        }))
        .then(Commands.literal('a').executes(ctx => {
          return ctx.source.player && chooseRespawn(ctx.source.player, 'a') ? 1 : 0
        }))
        .then(Commands.literal('b').executes(ctx => {
          return ctx.source.player && chooseRespawn(ctx.source.player, 'b') ? 1 : 0
        }))
        .then(Commands.literal('c').executes(ctx => {
          return ctx.source.player && chooseRespawn(ctx.source.player, 'c') ? 1 : 0
        }))
        .then(Commands.literal('d').executes(ctx => {
          return ctx.source.player && chooseRespawn(ctx.source.player, 'd') ? 1 : 0
        }))
        .then(Commands.literal('e').executes(ctx => {
          return ctx.source.player && chooseRespawn(ctx.source.player, 'e') ? 1 : 0
        }))
      )
      .then(Commands.literal('status').executes(ctx => {
        if (ctx.source.player) {
          ctx.source.player.tell(Text.gold(`試合状態：${state.active ? '進行中' : '待機中'}　|　赤軍 ${state.redTickets}　|　青軍 ${state.blueTickets}`))
        }
        return 1
      }))
  )
})

PlayerEvents.loggedIn(event => {
  if (!event.player.tags.contains('conq_lobby_initialized')) {
    command(event.player.server, `tag ${event.player.username} add conq_lobby_initialized`)
    sendToLobby(event.player)
    event.player.tell(Text.gold('コンクエスト・ロビーへようこそ。感圧板で陣営と兵科を選択してください。'))
  }
  if (state.active && !teamOf(event.player)) makeSpectator(event.player)
})

PlayerEvents.respawned(event => {
  if (!state.active) return
  const spawn = spawnFor(event.player)
  if (spawn) teleportToBattlefield(event.player, spawn)
  const selectedKit = kitOf(event.player)
  if (selectedKit) giveKit(event.player, selectedKit, false)
  else setNormalHealth(event.player)
})

EntityEvents.death('player', event => {
  if (!state.active) return
  const victim = event.player || event.entity
  if (!victim) return
  const victimTeam = teamOf(victim)
  if (!victimTeam) return
  if (victimTeam === 'red') state.redTickets = Math.max(0, state.redTickets - 1)
  if (victimTeam === 'blue') state.blueTickets = Math.max(0, state.blueTickets - 1)
  syncTickets(victim.server)
  command(victim.server, `scoreboard players add ${victim.username} conq_deaths 1`)

  const killer = event.source ? event.source.player : null
  if (killer && teamOf(killer) && teamOf(killer) !== victimTeam) {
    command(victim.server, `scoreboard players add ${killer.username} conq_kills 1`)
  }
})

ServerEvents.tick(event => {
  state.ticks++
  if (!state.active) return
  if (state.ticks % 20 === 0) updateVehicles(event.server)
  if (state.ticks % 20 === 0) CONQUEST.flags.forEach(flag => updateFlag(event.server, flag))
  if (state.ticks % CONQUEST.scoreIntervalTicks === 0) ticketDrain(event.server)
})

