-- Softens hard tone steps with a 1px checker band, in place: where a pixel of
-- colour A touches colour B (a listed pair), every other pixel on A's side of
-- the edge becomes B.
-- usage: aseprite -b --script-param file=<x.aseprite> --script-param pairs=fef1f5:fcc9c9,dac9e7:9884b8
--          [--script-param layers=body] [--script-param skip=x0,y0,x1,y1] --script dither.lua
local sprite = app.open(app.params["file"])
local function rgba(hex)
  local n = tonumber(hex, 16)
  return app.pixelColor.rgba(n >> 16, (n >> 8) & 255, n & 255, 255)
end
local pairs_ = {}
for a, b in string.gmatch(app.params["pairs"], "#?(%x%x%x%x%x%x):#?(%x%x%x%x%x%x)") do
  pairs_[#pairs_ + 1] = { rgba(a), rgba(b) }
end
local only = {}
for n in string.gmatch(app.params["layers"] or "", "[^,]+") do only[n] = true end
local skip = {}
for v in string.gmatch(app.params["skip"] or "", "-?%d+") do skip[#skip + 1] = tonumber(v) end
local function skipped(x, y)
  return #skip == 4 and x >= skip[1] and y >= skip[2] and x <= skip[3] and y <= skip[4]
end

local changed = 0
for _, cel in ipairs(sprite.cels) do
  if next(only) == nil or only[cel.layer.name] then
    local src = Image(sprite.width, sprite.height, sprite.colorMode)
    src:drawImage(cel.image, cel.position)
    local out = src:clone()
    for y = 1, sprite.height - 2 do
      for x = 1, sprite.width - 2 do
        if (x + y) % 2 == 0 and not skipped(x, y) then
          local p = src:getPixel(x, y)
          for _, pr in ipairs(pairs_) do
            if p == pr[1] and (src:getPixel(x - 1, y) == pr[2] or src:getPixel(x + 1, y) == pr[2]
                or src:getPixel(x, y - 1) == pr[2] or src:getPixel(x, y + 1) == pr[2]) then
              out:drawPixel(x, y, pr[2])
              changed = changed + 1
              break
            end
          end
        end
      end
    end
    cel.image = out
    cel.position = Point(0, 0)
  end
end
sprite:saveAs(app.params["file"])
print("dithered " .. changed .. " pixels")
