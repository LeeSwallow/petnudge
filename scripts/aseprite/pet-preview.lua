-- Pet preview: shows the layer combination the app would draw, so you can
-- edit one part in context (e.g. "smile, head turned left, cardigan").
-- Reads <id>.pack.json (or pack.json) next to the open .aseprite.
-- Install: File > Scripts > Open Scripts Folder, put this file (or a link to
-- it) there, then File > Scripts > Rescan Scripts Folder.
local sprite = app.sprite
if not sprite then return app.alert("캐릭터 .aseprite 파일을 먼저 열어주세요") end

local dir = app.fs.filePath(sprite.filename)
local id = app.fs.fileTitle(sprite.filename)
local manifest = app.fs.joinPath(dir, id .. ".pack.json")
if not app.fs.isFile(manifest) then manifest = app.fs.joinPath(dir, "pack.json") end
local file = io.open(manifest, "r")
if not file then return app.alert("팩 설정 파일을 찾지 못했어요: " .. manifest) end
local pack = json.decode(file:read("a"))
file:close()

-- image layers by name, and every head direction / pose found in the names
local layers, heads, headSeen = {}, { "front" }, {}
local function walk(list)
  for _, layer in ipairs(list) do
    if layer.isGroup then walk(layer.layers) else
      layers[layer.name] = layer
      local head = layer.name:match("@([%w_-]+)")
      if head and not headSeen[head] then headSeen[head] = true; heads[#heads + 1] = head end
    end
  end
end
walk(sprite.layers)

local function sorted(t)
  local out = {}
  for k in pairs(t) do out[#out + 1] = k end
  table.sort(out)
  return out
end
local faces = {}
for _, name in ipairs(sorted(pack.expressions or {})) do
  if not name:find("@") then faces[#faces + 1] = name end
end
if #faces == 0 then faces = { "open" } end
local poses = { "없음" }
for _, name in ipairs(sorted(pack.poses or {})) do poses[#poses + 1] = name end

-- Same rules as the app (src/shared/characterPack.ts layerCells).
local function pick(base, head, pose)
  if pose and layers[base .. "#" .. pose] then return base .. "#" .. pose end
  if head and layers[base .. "@" .. head] then return base .. "@" .. head end
  if layers[base] then return base end
end
local function cellsFor(face, head, pose, avatar)
  local expressions = pack.expressions
  local expression = expressions and ((head and expressions[face .. "@" .. head]) or expressions[face] or {})
  local poseCell = pose and pack.poses and pack.poses[pose]
  if type(poseCell) == "table" then poseCell = poseCell.cell end -- { cell, whole }
  local shown, posed = {}, false
  for _, layer in ipairs(pack.layers) do
    if poseCell and layer.group == "body" then
      if not posed then shown[poseCell] = true; posed = true end
    else
      local base, variant = layer.id, nil
      if layer.from == "slot" then
        variant = avatar[layer.id]
        base = variant ~= "none" and (layer.id .. "." .. variant) or nil
      elseif layer.from == "face" then
        if expression then
          variant = expression[layer.id] or "open"
          base = variant ~= "none" and (layer.id .. "." .. variant) or nil
        else
          base = "face." .. face
        end
      end
      local cell = base and pick(base, head, pose)
      if cell then shown[cell] = true end
    end
  end
  return shown
end

local dlg = Dialog{ title = "펫 미리보기 · " .. pack.name }
dlg:combobox{ id = "face", label = "표정", options = faces, option = faces[1] }
dlg:combobox{ id = "head", label = "고개", options = heads, option = "front" }
dlg:combobox{ id = "pose", label = "자세", options = poses, option = "없음" }
for _, slot in ipairs(sorted(pack.slots or {})) do
  local options, first = {}, nil
  for _, v in ipairs(sorted(pack.slots[slot].variants)) do
    options[#options + 1] = v
    if not first then first = v end
  end
  -- pack order isn't kept by json.decode; prefer a non-"none" default
  for _, v in ipairs(options) do if v ~= "none" then first = v; break end end
  dlg:combobox{ id = "slot_" .. slot, label = pack.slots[slot].label or slot, options = options, option = first }
end

local function setVisible(shown)
  app.transaction("펫 미리보기", function()
    for name, layer in pairs(layers) do layer.isVisible = shown[name] == true end
    local function openGroups(list)
      for _, layer in ipairs(list) do if layer.isGroup then layer.isVisible = true; openGroups(layer.layers) end end
    end
    openGroups(sprite.layers)
  end)
  app.refresh()
end

dlg:separator{}
dlg:button{ id = "apply", text = "앱처럼 보기", onclick = function()
  local d = dlg.data
  local avatar = {}
  for slot in pairs(pack.slots or {}) do avatar[slot] = d["slot_" .. slot] end
  local head = d.head ~= "front" and d.head or nil
  local pose = d.pose ~= "없음" and d.pose or nil
  setVisible(cellsFor(d.face, head, pose, avatar))
end }
dlg:button{ id = "solo", text = "선택 레이어만", onclick = function()
  local active = app.layer
  if not active or active.isGroup then return app.alert("부위 레이어를 하나 선택해주세요") end
  setVisible({ [active.name] = true })
end }
dlg:button{ id = "all", text = "모두 보기", onclick = function()
  local all = {}
  for name in pairs(layers) do all[name] = true end
  setVisible(all)
end }
dlg:show{ wait = false }
