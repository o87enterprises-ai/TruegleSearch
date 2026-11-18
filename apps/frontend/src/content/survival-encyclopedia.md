<!--
  THE SURVIVOR'S ENCYCLOPEDIA — the guide's source text.

  Structure, so the parser never has to guess:
    ###  X            a letter section (Part I, A–Z)
    ###  II | Title   a numbered section (Parts II–VIII and the closing notes)
    #### Name         an ENTRY. One per topic.
    **Bold**          a sub-heading INSIDE an entry
    | a | b |         a table (first row is the header)

  scripts/verify-encyclopedia.mjs checks every section parses, every entry has
  a body, and the offline copy contains all of it — so a malformed addition
  fails the build rather than quietly disappearing from the index.
-->

# The Survivor's Encyclopedia

**Expanded & Complete Edition — a living document for grid-independent living**

*This edition expands every original entry with greater technical depth, then adds the essential systems, charts, and guides: food production and preservation at scale, livestock husbandry, celestial and old-school navigation, electrical generation from first principles, emergency radio, practical mathematics, automotive repair logic, natural medicine, and a survival Spanish phrasebook. It is designed to be printed, practiced, and passed on. Nothing here replaces hands-on training before a crisis. Build skills now, while failure is reversible. The original entries are retained and deepened; where a build is given, safety notes and failure modes are added. Master the simple version first: complexity is a liability when you are tired, hungry, or injured.*

---

### A

#### Acorn Flour
Acorns are calorie-dense and abundant, but raw acorns contain tannins that cause kidney damage and gastrointestinal distress. **Processing is non-negotiable.**

**Step-by-step:**
1. **Identify** white oak acorns (less tannic) over red oak where possible. Discard acorns with holes (weevil larvae) or black spots.
2. **Shell** by cracking the cap end with a stone or nutcracker. Winnow the shells away.
3. **Leach** by one of two methods:
- **Hot water leaching:** Place shelled acorns in a pot of water, bring to a boil, then simmer. Change the water every 30 minutes until the water no longer turns brown and tastes bitter. This can take 2–4 hours.
- **Cold water leaching:** Place acorns in a porous sack in a stream or a bucket of water for 3–7 days, changing the water twice daily. This is slower but preserves more starch.
4. **Dry** the leached acorns in the sun or a solar dehydrator until brittle.
5. **Grind** in a grain mill, coffee grinder, or between stones. Sift to remove coarse particles. The resulting flour is gluten-free; use it in combination with wheat flour or as a thickener. Acorn flour makes dense bread; mix 1 part acorn to 2 parts wheat for a rise.

**Storage:** Keep in a sealed container in a cool, dark place; use within 6 months.

#### Alcohol Fuel
Ethanol from fermentation and distillation is a renewable fuel for stoves, lamps, and small engines. **Methanol is a deadly byproduct**; discard the first 50 mL of distillate per 20 L of mash (the "foreshot"). Never drink fuel-grade ethanol.

**See the Distillation entry and the safety protocol there for the pot-still build.**

#### Animal Traps (Deadfalls & Snares)
The ability to harvest small game silently without ammunition is a cornerstone of long-term survival. Two universal trap types are the figure-4 deadfall and the spring snare.

**Build: Figure-4 Deadfall**
*Materials*: A heavy flat stone or log (deadfall), three sticks of thumb-thickness and about 8–12 inches long.
1. **Carve the sticks**:
   - *Upright stick*: Sharpen one end to a point. Cut a flat notch 1 inch below the top. On the opposite side, cut a 90° shoulder 1 inch from the bottom.
   - *Bait stick* (horizontal): Sharpen one end to hold bait; carve a flat notch near the pointed end. On the other end, cut a square notch that hooks onto the upright stick's top notch.
   - *Trigger stick* (diagonal): Taper one end to a wedge. On the wide end, carve a small square notch that will hook onto the bait stick's lower notch.
2. **Assembly**: Raise the deadfall. Place the upright stick vertically with its bottom shoulder biting into a small depression on the ground. Hook the bait stick's square notch onto the upright's top notch, extending horizontally under the deadfall. Wedge the trigger stick between the bait stick's lower notch and the base of the upright, forming a "4" shape. The deadfall rests on the tapered end of the trigger stick. The slightest tug on the bait collapses the structure. Always approach from behind the deadfall.

**Build: Spring Snare (Twitch-Up)**
*Materials*: A flexible sapling (spring pole), strong cordage (paracord, rawhide, braided bark), two sticks for a trigger and peg, a loop line, and a toggle.
1. **Anchoring**: Sharpen a forked stake and drive it firmly into the ground along a game trail.
2. **Spring pole**: Strip a green sapling of branches, leaving it rooted or lashed securely to a base. Bend it down to the stake.
3. **Noose**: Tie a slip knot (see *Knots*) in the cordage and form a loop. Attach the standing end to the spring pole tip.
4. **Trigger mechanism**:
   - *Peg*: Carve a short peg with a notch. Drive it into the ground under the bent pole.
   - *Toggle*: Carve a stick with a round end and a square end. Tie the loop line near its middle.
   - Setting: Hold the pole down. Hook the toggle's square end over the peg notch. Lay the round end lightly under the forked stake. The tension of the pole pulls the toggle against the peg and stake, holding it. When an animal pulls the noose, the toggle dislodges, the pole springs up, and the noose tightens around the animal.
*Safety*: Mark snares clearly to avoid human injury; check them frequently.

**Expanded notes**
The original figure-4 and spring snare instructions are sound. Additional detail:

**Figure-4 deadfall — tuning:**
- The upright stick's bottom shoulder must bite into a shallow depression in firm ground. On soft ground, place a flat stone under the upright.
- The bait stick should extend under the deadfall at a height that forces the animal to raise its head—this ensures the trigger releases cleanly.
- Set the deadfall so it falls *parallel to the ground*, not at an angle. An angled fall can glance off the animal.
- **Safety:** Mark the trap with a bright cloth and check it at dawn and dusk. In a survival situation, a human foot in a deadfall is a catastrophe. Never set traps on human trails.

**Spring snare — toggle geometry:**
The toggle must be carved with a **round end** (which sits under the forked stake) and a **square end** (which hooks over the peg). The square end must be oriented so that the tension of the bent sapling pulls it *against* the peg, not off it. Test the trigger by hand: it should release with 2–3 pounds of pull. If it releases too easily, the square notch is too shallow; if it will not release, the toggle is binding on the peg.

**Legal and ethical note:** Snares are indiscriminate. In a genuine survival emergency, they are justified; in ordinary times, check local laws.

#### Aquaponics (Small-Scale Barrel System)
A closed-loop system where fish waste provides nutrients for plants, and plants filter water for fish. Suitable for year-round greens and protein.

**Build Instructions (IBC Tote or Barrel System)**
*Materials*: 1 food-grade IBC tote (275 gal), a small water pump (12V DC with solar panel), bell siphon kit (or make one), grow media (expanded clay pebbles or washed gravel), fish tank (bottom third of tote), grow bed (top two-thirds, cut and inverted). If using two barrels, one for fish, one for grow bed.
1. **Cut the IBC tote**: Using a saw, cut the plastic cage and tank horizontally. The bottom section (fish tank) should be 12–18 inches deep. The top becomes the grow bed, supported above the fish tank by the cage frame.
2. **Plumbing**: Install a bulkhead fitting in the grow bed for a standpipe. Build a bell siphon: a vertical pipe (standpipe) capped with a bell (a larger diameter pipe with a notched bottom) surrounded by a media guard. Water rises to the top of the standpipe, then siphons rapidly down, creating an ebb-and-flow cycle.
3. **Pump**: Place pump in fish tank, run tubing to grow bed. Adjust flow rate to flood the bed in ~15 minutes and drain in 15 minutes.
4. **Cycling**: Fill with dechlorinated water. Add ammonia (or fish food) to start nitrogen cycle. Introduce fish (tilapia, goldfish) once ammonia and nitrite are zero and nitrates present.
5. **Planting**: Plant leafy greens directly into grow media. System is virtually self-sustaining if powered by solar.

**Expanded notes**
The IBC tote system is the gold standard, but **the most common failure is the bell siphon.** If the siphon fails to start, the grow bed floods and drowns plant roots; if it fails to break, the bed never drains and the system stagnates.

**Bell siphon troubleshooting:**

| Symptom | Cause | Fix |
|---|---|---|
| Siphon never starts | Standpipe too tall relative to flow; air trap in bell | Lower standpipe by 1 inch; drill a small vent hole at the top of the bell |
| Siphon starts but won't stop | Standpipe extends too far below the bell; air cannot enter to break siphon | Shorten standpipe so its bottom is at least 1 inch above the grow-bed floor |
| Gurgling and slow drain | Media guard clogged with roots or sludge | Remove guard, rinse, trim roots |

**Cycling without test kits:** The nitrogen cycle can be managed by observation. Cloudy water that clears over 2–3 weeks indicates a bacterial bloom. Add fish only when a pinch of fish food added to the water disappears without fouling within 24 hours. Start with 10% of the planned fish load and increase monthly.

#### Atlatl (Spear-Thrower)
A primitive weapon that extends the human arm, propelling a dart with lethal force. Quieter than firearms, renewable ammunition.

**Build Instructions**
*Materials*: A hardwood stick 18–24 inches long, 1–1.5 inches wide (the atlatl), a straight 5–6 foot dart shaft (river cane, willow, or straight sapling), feathers for fletching, cordage and glue (pine pitch).
1. **Atlatl body**: Carve a flat board with a handle that fits comfortably. At the back end, carve a spur (a small peg) projecting upward at a 30–45° angle. Alternatively, attach a bone or hardwood spur with sinew and pitch.
2. **Dart**: Straighten the shaft by heating over coals and bending. The dart should be about half the diameter of the atlatl's length. Sharpen one end or haft a stone/shell point using sinew and pitch. At the butt, drill a dimple or shallow socket to seat onto the spur.
3. **Fletching**: Split feathers and lash three vanes to the rear of the dart to stabilize flight.
4. **Throwing**: Hook the spur into the dart butt. Grip the atlatl handle, hold dart parallel. Flick the wrist forward, releasing the dart with a snapping motion while maintaining forward momentum. Practice yields accurate throws to 30+ yards.

**Expanded notes**
The atlatl multiplies the effective length of the throwing arm. The critical variable is **dart spine** (stiffness). A dart that is too flexible will wobble in flight; too stiff and it will not recover. For a 5–6 foot cane dart, select a shaft with a wall thickness that resists bending when you press the ends together with moderate hand pressure.

**Spur geometry:** The spur should engage the dart butt at 30–45° and be *slightly undercut* so the dart releases cleanly when the wrist snaps. A spur that is too long will drag; too short and the dart will slip off during the throw.

**Practice progression:** Throw at a large target (a hay bale) from 5 yards until you can group within 3 feet. Move back 5 yards at a time. Most beginners release too early; the dart should leave the atlatl at the *end* of the forward snap, not during the wind-up.

### B

#### Bow Drill Fire – See *Fire Making*

#### Basket Weaving (Coiled Baskets)
Essential for gathering, storage, winnowing, and cooking (watertight baskets for stone boiling).

**Build: Coiled Pine Needle Basket**
*Materials*: Long pine needles (dry but pliable), a large-eye needle or awl, strong thread (sinew, rawhide strip, or waxed linen).
1. **Start center coil**: Gather a bundle of needles about 1/4 inch thick. Wrap the bundle tightly with thread for an inch, then bend it into a tight loop and stitch through the center to secure.
2. **Coiling**: Continue wrapping thread around the bundle and stitching it to the previous coil. Each stitch should go through the previous row's thread, pulling tight. Add needles gradually to keep bundle uniform.
3. **Shaping**: Control the angle of each new row to flare sides outward for a bowl or keep vertical for a cylinder.
4. **Finishing**: Taper the final bundle and stitch down. For watertightness, rub the interior with pine pitch or beeswax, though coiled baskets are typically not completely watertight; they can be used with hot stones for boiling.

**Expanded notes**
Coiled baskets are strong and repairable. The original pine-needle method is excellent. Additional detail on **watertightness:** A coiled basket will never be fully waterproof, but it can be made *water-resistant enough* for stone boiling if the interior is sealed with pine pitch, beeswax, or a slurry of clay and ash. **Stone boiling:** Heat fist-sized stones in a fire, then transfer them to the basket filled with water using wooden tongs. The water will boil within minutes. Do not use river stones (they can explode); use dry, igneous or metamorphic stones.

**Material alternatives:** Split oak saplings, willow bark, cattail leaves, and yucca fibers all work. The key is uniform thickness of the bundle; irregular bundles produce a lumpy, weak basket.

#### Blacksmithing (Ground Forge)
The ability to shape iron and steel using reclaimed metal (leaf springs, rebar) gives unmatched toolmaking capacity.

**Build: Simple Side-Blast Charcoal Forge**
*Materials*: A large steel brake drum or thick-walled metal basin, 2-inch steel pipe (tuyere), a blower (hand-crank blower, hair dryer with 12V battery, or double-action bellows), refractory clay/sand mix.
1. **Forge pot**: Set the brake drum on a stand of bricks or a welded frame. The pipe comes from the side into the bottom of the drum. Cut a hole and weld or bolt the pipe so it points into the center.
2. **Tuyere**: Line the bottom of the drum around the pipe opening with a mix of clay, sand, and ash (2:1:1) to protect the metal. Form a shallow bowl shape with a depression for the air blast.
3. **Air supply**: If making bellows, construct a double-chamber bellows from plywood, leather, and valves. Connect to tuyere with a flexible hose.
4. **Fuel**: Lump charcoal (see *Charcoal Making*) or good-quality bituminous coal. Light a wood fire, add charcoal, and start a gentle blast. Adjust air to reach forge welding heat (yellow-white).
5. **Anvil**: A section of railroad track or a heavy block of steel mounted solidly. Hammers from 1.5 to 3 lbs, tongs made from mild steel rebar. Start with simple tools: fire rake, poker, chisels.

**Expanded notes**
The side-blast charcoal forge is the most practical entry point. **Critical safety additions:**
- **Never use galvanized steel** in the forge or as a tuyere. Galvanized coatings release zinc oxide fumes that cause metal fume fever (flu-like symptoms that can be severe). Use black iron pipe or mild steel.
- **Charcoal storage:** Keep fuel dry. Wet charcoal produces steam and can crack the forge lining.
- **Quenching oil:** Warm oil (120–140°F) quenches faster than cold oil and reduces the risk of cracking thin sections. Used motor oil works but produces smoke; canola or peanut oil is cleaner.

**First projects:** Make a **fire rake** (a straight rod with a bent end), a **poker**, and a **cold chisel**. These teach drawing out, bending, and heat treatment without requiring precise tolerances.

#### Bowyer's Craft (Self Bow from a Stave)
Building a wooden bow that can take game is a multi-week process but yields a lifelong tool.

**Build: Flatbow from Osage or Hickory**
*Materials*: A straight-grained stave (6 ft long, 2–3 inches diameter, split and dried for months), drawknife, rasp, scraper, tillering string, bowstring (B-50 Dacron or sinew).
1. **Layout**: Find the crown of the back (outside of tree). Mark a centerline and a handle section (4 inches centered), limbs 2 inches wide at fades (transitions) tapering to 1/2 inch at nocks.
2. **Rough-out**: Using hatchet and drawknife, reduce stave to profile. Leave belly (inside) flat. Follow one growth ring on the back without violating it.
3. **Floor tillering**: Bend the bow slightly by hand on the floor to see even bend. Remove wood from stiff areas. Use a cabinet scraper.
4. **Tillering tree**: Use a board with notches to draw the bow with a long string. Pull inches, exercise limbs. Achieve even curve. Final draw weight at 28 inches desired (e.g., 45–55 lbs).
5. **Finishing**: Sand smooth, seal with oil/wax. Wrap handle. Serve bowstring with nocking point.

**Expanded notes**
The original flatbow instructions are correct. The most common beginner error is **violating the growth ring on the back of the bow.** The back of the bow is the side facing *away* from the archer; it must be a single, unbroken growth ring. If you cut through that ring, the bow will lift a splinter and break.

**Tillering logic:** Remove wood *only* from the belly (the side facing the archer). Never remove wood from the back. Work slowly: 10 strokes with a scraper, then exercise the limb 20 times on the tillering tree, then check the curve. A bow that bends evenly at 20 inches will usually survive to 28 inches. A bow with a hinge (a spot that bends too much) will break at that hinge. Mark hinges with pencil and scrape *around* them, not on them.

**String follow:** A wooden bow takes a permanent bend ("string follow") after use. This is normal. Reflexing the stave (steaming and bending the tips forward) can compensate, but is an advanced skill.

### C

#### Compost Toilet (Humanure) – See *Sanitation*

#### Candle Making (Tallow & Beeswax)
Light without electricity. Tallow (rendered animal fat) or beeswax makes long-burning candles.

**Build: Dipped Tallow Candles**
*Materials*: Rendered tallow (strained), a double boiler, cotton string for wick, a dipping can (tall narrow container), stick.
1. **Render fat**: Heat chopped beef/mutton fat gently in water, strain, cool, skim pure tallow.
2. **Wick**: Braid cotton string, soak in saltwater or boric acid solution (fire retardant), dry.
3. **Dipping**: Fill the dipping can with melted tallow kept warm. Tie wicks to a stick. Dip wicks into tallow, lift, allow to cool for a minute, dip again. Repeat dozens of times to build up layers. Trim bottom. Dip pairs (two per stick) then cut apart.
4. **Molded candles**: Pour tallow into molds with wick centered, faster but less even burn.

**Expanded notes**
The original dipped-candle method is reliable. **Wick preparation is the most overlooked variable.** A cotton wick that is too thin will drown in melted tallow; too thick and it will smoke and curl. Braid three strands of cotton string to a finished diameter of about 1/8 inch for a 1-inch candle. Soak the braid in a solution of 1 tablespoon boric acid per cup of water (or 1 tablespoon salt per cup) and dry completely. This fire-retardant treatment makes the wick curl outward as it burns, exposing the tip to air.

**Tallow rendering purity:** Impure tallow (containing water or meat particles) will sputter and smell. After rendering, let the tallow cool slowly; the pure fat hardens on top and any water and debris settle below. Remove the fat cake and scrape the bottom clean.

#### Canning (Water Bath & Pressure)
**See Part II, section 2.3, for the complete preservation section, including altitude adjustments and spoilage detection.**

#### Charcoal Making (Retort Method)
Charcoal burns cleaner and hotter than wood, essential for blacksmithing and water filters.

**Build: Simple Earth Pit Kiln**
*Materials*: Hardwood (oak, hickory), shovel, dry grass/kindling, flat rocks, sheet metal or turf.
1. **Dig pit**: 3 ft deep, 3 ft wide, slope sides.
2. **Stack wood**: Split wood into uniform 2–3 inch thick pieces, stand them upright tightly in the pit. Leave a flue hole at the bottom side and an exhaust at the top.
3. **Cover**: Build a layer of small branches over the top, then cover with turf, mud, or sheet metal leaving a central smoke hole.
4. **Ignition**: Light a fire in the bottom flue, let it catch the wood. Once burning well, seal flue and smoke hole partially, then fully when thick yellow smoke turns blue/clear. Let smolder 24–48 hours, cool completely before opening. Yield: black, lightweight charcoal with metallic clink.

**Build: Retort Drum Kiln (Two-Barrel)**
*Materials*: 55-gallon drum (retort) inside a 200-liter drum (fire chamber), chimney.
- Fill inner drum with wood, seal with lid but drill small gas vent. Pipe vent gases to firebox under outer drum to burn them, making process smokeless and more efficient. Instructions: Outer drum cut with door, inner drum elevated, vent pipe runs to burner. Ignite wood gas to heat retort.

**Expanded notes**
The earth-pit kiln is forgiving but inefficient. The **two-barrel retort** is the superior method for consistent, high-quality charcoal.

**Retort principles:** The inner drum holds the wood to be charred. The outer drum is the firebox. The gases driven off the wood (wood gas, methanol, tar) are piped from the inner drum's vent into the firebox, where they burn and provide heat for the process. This makes the retort largely self-fueling and produces very little smoke once it reaches temperature.

**Troubleshooting:**

| Problem | Cause | Fix |
|---|---|---|
| Yellow smoke throughout | Incomplete combustion; air leaks | Seal all seams with clay; close vents partially |
| Charcoal is brown, not black | Process stopped too early | Continue until smoke turns blue/clear and the drum cools; brown charcoal still contains volatiles and will smoke in the forge |
| Drum warped or cracked | Excessive heat; thin-wall drum | Use a heavier drum; reduce the firebox fuel load |

**Yield:** 55-gallon drum of hardwood yields roughly 15–20 gallons of finished charcoal.

#### Cob Oven (Earthen Oven)
Bakes bread, pizza, roasts meat with retained heat. Simple materials.

**Build Instructions**
*Materials*: Clay-rich subsoil, sand, straw (cob mix), firebricks or stones for base, glass bottle for chimney (optional), wooden form for dome (sand form).
1. **Foundation**: Build a sturdy table-height base of stone, brick, or wood topped with a layer of firebricks or a sand/clay insulation bed.
2. **Form**: Pile damp sand into a perfect dome shape the size of your oven interior (approx. 24–28 inches diameter). Cover sand with wet newspaper.
3. **Cob layer**: Mix clay soil (75% sand, 25% clay) with straw and water to a stiff consistency. Apply a 4-inch thick layer of cob over the sand form, sculpting a flattened dome. Leave a door opening arch at the front (width 40% of dome, height 63% of width for optimal draft).
4. **Insulating layer**: A second layer of lighter cob (more straw, or sawdust) 4–6 inches thick, or cover with a mixture of clay slip and straw.
5. **Curing**: Cut the door opening fully. Scoop out the sand. Let dry for a week, then build small fires inside daily to harden completely. Door can be a wooden board insulated with cob. Operating principle: fire burns inside for 2–3 hours until dome turns clear, coals raked out, floor swabbed, bread loaded, door sealed. Heat stored in mass bakes for hours.

**Expanded notes**
The original instructions are solid. **The door ratio is critical:** width 40% of dome diameter, height 63% of width. A door that is too large loses heat rapidly; too small and you cannot load bread without hitting the top.

**Curing schedule (do not rush):**
- Day 1–2: Air dry only.
- Day 3: Small fire (a few sticks) for 2 hours.
- Day 4: Medium fire for 4 hours.
- Day 5–7: Full fire for 2–3 hours daily.
- If cracks larger than 1/4 inch appear, fill with a slurry of clay and sand and allow to dry before the next fire.

**Baking protocol:** Fire the oven for 2–3 hours until the dome turns clear (the soot burns off). Rake out coals and ash. Swab the floor with a wet rag on a stick (this removes ash and creates steam). Load bread, seal the door with a wooden board insulated with a wet towel. Retained heat will bake 2–3 batches of bread over 4–6 hours.

#### Cordage (Natural Rope Making)
**Reverse-wrap two-ply cordage** from plant fibers (dogbane, milkweed, nettle, yucca).
1. **Harvest**: Collect stalks, dry, crush to extract long bast fibers.
2. **Form two bundles**: Hold one bundle in left hand, twist it clockwise (away from you) until it kinks. Hook the twisted bundle over your thumb, pinch with the second bundle, and twist both counter-clockwise together (wrap). Repeat: twist bundle, wrap around. Splicing new fibers in is continuous. Result is incredibly strong rope.

**Expanded notes**
Reverse-wrap two-ply cordage is the foundation of all rope making. **Fiber selection matters:**

| Fiber | Strength | Best use |
|---|---|---|
| Dogbane / Indian hemp | Very strong, fine | Bowstrings, fishing line |
| Milkweed | Strong, silky | General cordage |
| Nettle | Strong, durable | Netting, lashings |
| Yucca | Coarse, stiff | Heavy lashings, sandals |
| Inner bark (basswood, cedar) | Moderate | Quick lashings, netting |

**Reverse-wrap mechanics:** Twist each bundle *clockwise* (away from you) while wrapping the two bundles together *counter-clockwise*. The opposing twists lock the fibers. If both twists go the same direction, the cordage unravels. Splice in new fibers by overlapping the ends by at least 4 inches and twisting them into the existing bundle.

### D

#### Distillation (Water & Alcohol)
Purifying water and producing ethanol fuel. Solar still for water; pot still for alcohol.

**Build: Solar Still (Pit Type)**
*Materials*: Plastic sheet (clear, 6x6 ft), a container, a rock, a digging tool, vegetation (optional).
1. **Dig a hole** 3 ft wide, 2 ft deep in sunny soil. Place collection container in center.
2. **Place green vegetation** (urine if desperate) around container to add moisture.
3. **Cover with plastic sheet**, seal edges with soil/rocks. Place a small rock in center directly above container.
4. Sun evaporates moisture, condenses on plastic, drips into container. Produces 1–2 liters per day.

**Build: Pot Still for Ethanol (Permit-aware; for survival fuel)**
*Materials*: A large stainless steel pot (boiler), copper tubing (1/4 inch, 10-20 ft coil), a cooling bucket, flour paste seal, thermometer.
1. **Boiler lid**: Drill a hole and fit a bulkhead or compression fitting for copper tube. Seal permanently.
2. **Column/arm**: Attach copper tube from lid and slope downward, then coil inside a bucket (condenser). The bucket is filled with cold water, which must be circulated or exchanged.
3. **Mash**: Ferment sugar, fruit, or grain mash to ~10–15% alcohol. Pour into boiler (never more than 3/4 full). Heat gently to 78–82°C. Alcohol vapors travel through arm, condense, drip into collection jar. Discard first 50 ml (methanol). Watch for temperature spikes. *Warning: alcohol vapors flammable; do indoors only with extreme ventilation.* Produces fuel for stoves, engines, medical disinfectant.

**Expanded notes**
**Solar still (pit type):** The original design works, but yield can be doubled by **adding a second, smaller still** or by placing the still in a depression lined with black plastic (which absorbs more heat). In arid environments, a **vegetation still** (a plastic bag tied over a leafy branch) can supplement the pit still. Do not rely on urine as a primary water source; the urea must be evaporated away, and the yield is poor.

**Pot still safety — expanded:**
- **Lead is the hidden danger.** Never use lead solder, leaded brass fittings, or galvanized pipe in a still that will produce drinking alcohol or essential oils. Use copper, stainless steel, or food-grade silicone.
- **Methanol separation:** Methanol boils at 64.7°C, ethanol at 78.4°C. The foreshot (first 50 mL per 20 L) contains the majority of methanol. Discard it. The heads (next 100–200 mL) also contain methanol and should be discarded or saved for solvent use. The hearts (the middle run) are the usable product.
- **Temperature control:** A simple thermometer in the boiler head is essential. If temperature exceeds 85°C, water vapor and tails (fusel oils) contaminate the product. Reduce heat immediately.
- **Open flame danger:** Alcohol vapor is heavier than air and can flash back. Distill outdoors or in a highly ventilated space with no ignition sources.

### E

#### Ethanol Fuel – See *Distillation*

#### Emergency Sanitation – See *Sanitation*

#### Electricity (Off-Grid 12V Solar System)
A basic solar setup powers lights, communication, and small tools indefinitely.

**Build: 200-Watt 12V Solar Generator**
*Components*: 2 x 100W monocrystalline solar panels, 20A MPPT or PWM charge controller, 100Ah deep-cycle AGM battery, 1000W pure sine wave inverter, fuses, cables, terminal lugs.
1. **Mount panels** facing true south (northern hemisphere) at an angle equal to latitude. Wire panels in parallel (with MC4 branch connectors) for 12V, or in series for 24V system.
2. **Charge controller**: Connect battery first to controller, then solar input. Ensure proper polarity. Set battery type to AGM.
3. **Battery**: Place in ventilated box. Connect inverter to battery terminals via a 100A fuse at positive.
4. **Loads**: Use 12V LED lights directly from controller load terminals, or AC from inverter. Calculate daily watt-hours and never discharge battery below 50%. Expand with more panels and batteries.
*Alternative: DIY wind turbine from car alternator with blades, requires dump load controller.*

**Expanded notes**
The original 200W system is a good starting point. **Critical sizing math:**
- **Daily energy budget:** List every load in watts × hours used. A 10W LED light for 5 hours = 50 Wh. A 5W radio for 4 hours = 20 Wh. Total daily Wh ÷ 12V = daily Ah needed.
- **Battery sizing:** For a 100Ah AGM battery, usable capacity is 50Ah (50% depth of discharge). If daily demand is 30Ah, you have less than 2 days of autonomy. Plan for 3–5 days of cloudy weather.
- **Panel sizing:** A 100W panel produces roughly 30–35Ah per day in full sun (5 peak sun hours). Two panels produce 60–70Ah, which replenishes a 30Ah daily draw and allows for cloudy days.

**Wiring:**
- **Fuses are not optional.** A 100A fuse at the battery positive terminal protects the inverter wiring. A 20A fuse between the charge controller and battery protects the controller.
- **Wire gauge:** For a 12V system, voltage drop is the enemy. Use 10 AWG for panel-to-controller runs under 20 feet; 8 AWG for 20–40 feet. Undersized wire wastes power as heat and can melt insulation.

**Battery maintenance:** AGM batteries are sealed but not immortal. Keep them above 50% state of charge. Equalize (a controlled overcharge) every 3–6 months per manufacturer instructions to prevent stratification. Never store a lead-acid battery on concrete in freezing conditions; insulate the box.

### F

#### Food Preservation – See *Canning, Smoking, Root Cellaring, Fermentation*

#### Fire Making (Bow Drill)
The most reliable friction fire method using wood-on-wood.

**Build: Bow Drill Set**
*Materials*:
- *Spindle*: dead, dry hardwood (willow, cottonwood, cedar) 8–10 inch, pencil-thick.
- *Fireboard*: same or softer wood, flat board 1/2 inch thick.
- *Bow*: curved green stick, string (paracord or rawhide).
- *Bearing block*: hard wood or stone with a socket, lubricated with green leaves or earwax.
- *Tinder nest*: shredded dry bark, grass, char cloth.
1. **Carve fireboard**: Cut a V-notch on the edge, and a shallow depression at the point of the V.
2. **Assembly**: Loop bowstring once around spindle. Place spindle tip in fireboard depression, hold bearing block on top.
3. **Drilling**: Saw the bow back and forth with long, steady strokes, pressing down lightly at first to form dust, then harder. A pile of black dust accumulates in the notch until it's smoking on its own.
4. **Ignition**: Gently tap fireboard to release the coal onto your tinder nest. Fold the tinder around it, blow steadily until flame erupts. Place into kindling structure.

**Expanded notes**
The bow drill is the most reliable friction method, but **wood selection is 80% of success.**

| Component | Ideal wood | Why |
|---|---|---|
| Spindle | Cottonwood, willow, cedar, yucca | Soft enough to create dust, hard enough to resist wear |
| Fireboard | Same or slightly softer than spindle | Must accept the spindle tip without glazing |
| Bearing block | Hardwood (oak, hickory) or stone | Must not create friction that burns your hand |

**The "burn-in" step:** Before attempting a coal, drill the spindle into the fireboard until the depression is the diameter of the spindle and the wood is blackened. Then cut the V-notch. The notch should remove about 1/8 of the circle's circumference and extend to the center of the depression. This is where the dust piles and the coal forms.

**Dust color:** Black, fine dust = good. Brown, gritty dust = too soft or too wet. If the dust is not forming, the spindle is glazed; roughen it with a knife.

#### Fire Reflector (Dakota Fire Hole)
A concealed, efficient cooking fire.
Dig a hole 12 inches deep, then a smaller tunnel angling to the bottom from upwind. Air feeds the fire, smoke minimal, ideal for leave-no-trace.

**Expanded notes**
The Dakota fire hole is a **concealed, high-efficiency cooking fire.** The original instructions are correct. Additional detail: the fire hole should be dug on the **upwind side of the main hole** so that air is forced into the base of the fire. In wet conditions, line the main hole with flat stones (dry, not river stones) to retain heat and keep the fire off the waterlogged ground. The Dakota hole burns hotter and with less smoke than a surface fire, making it ideal when concealment matters.

#### Fishing (Primitive Fish Traps)
**Build: Basket Fish Trap (Wicker)**
*Materials*: Green willow withies, vines.
1. **Frame**: Form a cylinder by bending a thick withy into a hoop and lashing. Use several hoops for shape.
2. **Weave**: Use the stake-and-strand method, inserting thin, flexible withies as warp and weaving weft over and under.
3. **Funnel entrance**: Create a separate cone with a small opening at the narrow end, inserted into the trap so fish swim in but can't find the exit.
4. **Bait** with guts, place in stream with opening facing downstream. Check daily.

**Expanded notes**
The wicker basket trap is effective in streams. **Placement is everything:** the trap should be placed where fish naturally funnel—at the mouth of a pool, beside a large rock, or in a narrow channel between two obstructions. The funnel opening should face *downstream* so fish swim into the current and enter the trap. Bait with fish guts, crushed snails, or bread. Check daily; a trap left too long will drown the catch and attract scavengers.

#### Foraging & Wild Foods (Universal Edibility Test)
When identifying unknown plants, follow strict protocol:
1. Separate plant into parts (root, stem, leaf, flower).
2. Smell for strong odors (peach/bitter almond might indicate cyanide).
3. Skin contact test: rub on inside of wrist, wait 15 mins.
4. Lip test, tongue test, then chew small amount and wait 8 hours. If no reaction, swallow tiny portion and wait another 8 hours. If no ill effects, plant part is likely safe in moderation. *Never skip steps; some deadly plants require time.* Refer to field guides: cattails (every part edible), dandelion, burdock, acorns (leach tannins).

### G

#### Gardening (Biointensive Raised Beds)
Maximize yields in minimal space with deep soil preparation.

**Build: Double-Dig Raised Bed**
*Materials*: Compost, spade, fork, boards (optional).
1. **Mark bed** 4 ft wide, any length. Remove topsoil of first 1 ft trench and set aside.
2. **Loosen subsoil** another 12 inches with fork, adding compost.
3. **Move next trench**: Slide topsoil from second trench into first, loosening its subsoil. Repeat.
4. **Amend**: Final bed is fluffy, rich, 24 inches deep. Plant intensively in hexagonal spacing. Companion planting: corn, beans, squash (Three Sisters). Water with ollas (unglazed clay pots buried, see *Ollas*).

**Expanded notes**
Double-digging is labor-intensive but produces deep, loose soil that roots penetrate easily. **The key is not to mix the horizons:** topsoil goes back on top, subsoil stays below. If you invert the layers, you bury organic matter and create a hardpan.

**Hexagonal spacing:** Plants spaced in a hexagonal pattern (staggered rows) use space 15–20% more efficiently than square grids. For a 4-foot bed, plant three rows staggered: row 1 at 0, 6, 12, 18... inches; row 2 offset by 3 inches.

**Three Sisters:** Corn provides a trellis for beans; beans fix nitrogen; squash shades the soil and deters pests with prickly vines. Plant corn first, then beans when corn is 6 inches tall, then squash when beans are established.

#### Greenhouse (Polyethylene Hoop House)
**Build Instructions**
*Materials*: 1/2-inch PVC conduit 10 ft lengths, rebar stakes, greenhouse plastic 6-mil, wiggle wire or batten tape, wooden base frame.
1. **Base**: Build a rectangle frame from 2x6 lumber, anchor with rebar.
2. **Hoops**: Cut PVC into 20 ft sections with couplings. Bend over bed, insert ends over 2-ft rebar stakes driven along base every 4 ft.
3. **Ridgepole**: Connect hoops along top with a PVC pipe. End walls framed with wood, door.
4. **Cover**: Drape plastic, secure with lath strips screwed onto base and end walls, or use wiggle wire channels. Ventilation: roll-up sides.

**Expanded notes**
PVC hoop houses are cheap and effective but **PVC degrades in UV light.** Paint the PVC with a UV-resistant paint or wrap it in tape where it contacts the plastic. The plastic covering should be **6-mil greenhouse film** (not construction plastic), which is stabilized against UV. Ventilation is not optional: without roll-up sides or end-wall vents, interior temperatures can exceed 120°F on a sunny day, killing plants. Open vents when interior temperature exceeds 75°F.

### H

#### Hammock & Tarp Shelter
Lightweight, bug-proof sleeping system.

**Build: Gathered-End Hammock**
*Materials*: 4 yards ripstop nylon, tree straps, whoopie slings, bug net.
1. Hem edges. Gather ends using a "channel" method or whipped end.
2. Run suspension through channels. Tarp diamond or A-frame pitch over ridgeline.

**Expanded notes**
The gathered-end hammock is comfortable and keeps you off wet ground. **Whoopie slings** are adjustable and lightweight, but require a bury splice (a hollow braid splice) that holds under load. For a quick deploy, use **tree straps** (1-inch webbing) to protect tree bark and distribute load. Hang the hammock with a 30° sag; too tight and you will wake with a sore back.

**Tarp pitch:** A diamond pitch sheds rain efficiently and provides a dry area underneath. Set the ridgeline above the hammock, with the tarp's corners guyed out. In windy conditions, use a low A-frame pitch and stake the edges to the ground.

#### Herbal Medicine (Basic Apothecary)
*Yarrow*: styptic (stop bleeding), *Plantain*: poultice for bites/stings, *Willow bark*: pain/fever (salicin).
**Tincture making**: 1 part dried herb to 5 parts 40% alcohol (vodka or homemade ethanol). Macerate 6 weeks, strain. Dose by drop.

**Expanded notes**
**See Part V for the comprehensive natural health guide.** The original entries are correct but incomplete. Yarrow (*Achillea millefolium*) is a styptic and also a fever reducer (diaphoretic). Plantain (*Plantago major*) poultice is effective for insect bites and minor wounds. Willow bark contains salicin, the precursor to aspirin; **do not give to children with viral illness** (Reye's syndrome risk) and avoid in people with aspirin allergy.

### I

#### Insulation (Natural Shelter Insulation)
**Cob/Mud and Debris Hut**: Layer thick leaves, grass between branches to trap air. Build a frame of poles covered with a layer of packed mud and leaves, R-value improves. For extreme cold, construct an insulating liner of space blankets or Mylar inside a shelter.

**Expanded notes**
The debris hut is the most reliable emergency shelter. **The rule of thumb:** the insulating layer should be **2–3 feet thick** on the sides and top. A thin layer of leaves is worse than useless because it creates a false sense of security. Build the frame of poles first, then pile leaves, grass, and duff until the shelter is a mound. Crawl inside to compress the floor layer; you need enough insulation *under* you as well as over you.

**Cob insulation:** A mud-and-straw mix is not a good insulator when wet. For cold climates, use a **double-wall** design: an inner wall of cob for thermal mass, an outer wall of light straw-clay or cordwood, and a cavity filled with dry leaves or sawdust.

#### Iron Smelting (Bloomery Furnace)
Advanced, but buildable from clay. Stack a chimney, charge charcoal and roasted bog iron ore, blast air with bellows. Produces a sponge of iron (bloom) that is forge-welded into workable metal. Full description would require many pages; recommend "Mastery and Uses of Fire" by Lars Enander.

**Expanded notes**
This is an advanced skill. The original description is accurate but understates the difficulty. **The critical variables are air volume and ore quality.** Bog iron ore must be roasted (heated in a fire) to drive off water and sulfur before smelting. The furnace must reach 1,100–1,200°C, which requires a sustained blast from bellows. The product is a **bloom**—a spongy mass of iron and slag—which must be hammered while hot to consolidate the metal and expel slag. Expect a 20–30% yield from good ore.

### K

#### Knots (Essential Survival Knots)
- *Bowline*: Loop that won't slip, rescue. Form a loop, rabbit comes out of hole, around tree, back down hole.
- *Taut-line hitch*: Adjustable tension for tent lines. Wrap around standing part, then two half hitches.
- *Trucker's hitch*: Tightening tarp lines. Loop in middle, pass end around anchor, back through loop, pull.
- *Clove hitch*: Starting lashings. Two crossing turns around post.

**Expanded notes**
| Knot | Primary use | Key detail |
|---|---|---|
| **Bowline** | Fixed loop that will not slip | The "rabbit" (working end) must come *up* out of the hole, around the tree, and *back down* the hole. A bowline inside-out is dangerous. |
| **Taut-line hitch** | Adjustable tent lines | Two wraps inside the loop, one outside. The hitch slides when unloaded and grips when loaded. |
| **Trucker's hitch** | Mechanical advantage for tightening | The loop acts as a pulley; you can tension a line to 3:1. Finish with two half hitches. |
| **Clove hitch** | Starting lashings | Two crossing turns. Under load, it can slip; add a half hitch to secure. |
| **Sheet bend** | Joining two ropes of different diameter | The thinner rope makes the bight; the thicker rope wraps around it. |

### L

#### Leather Tanning (Bark Tan)
Producing durable, non-rotting leather using tannins.

**Build: Bark Tanning Process**
1. **Fleshing**: Scrape raw hide clean of flesh and fat, using a beam scraper.
2. **De-hair**: Soak in lime (wood ash lye) or let rot slightly, then scrape hair off.
3. **Tanning**: Soak de-haired hide in a series of increasingly strong solutions made from boiling oak or hemlock bark. Start in weak liquor, move to stronger over weeks/months, stirring daily.
4. **Finishing**: Oil while damp, work over a stake to soften. For buckskin, use brain or egg tanning (smoke afterwards).

**Expanded notes**
Bark tanning is slow but produces durable, rot-resistant leather. **The critical step is de-hairing.** Soak the hide in a lime solution (wood ash lye) for 3–7 days until the hair slips easily. Scrape the hair and epidermis off with a dull knife or a beam scraper. **Do not skip the deliming step:** rinse the hide thoroughly and soak in a weak acid solution (bran water or vinegar) to neutralize the lime before tanning.

**Tanning liquor strength:** Start with a weak tea-colored liquor and gradually increase over weeks. A hide tanned too quickly in strong liquor will be brittle on the surface and raw in the center. Test by cutting a small slit at the edge; the interior should be the same color as the surface.

#### Lime Mortar & Plaster – Burn limestone (calcium carbonate) in a kiln at 900°C to make quicklime, slake with water to produce lime putty, mix with sand. Cures by absorbing CO₂.

### M

#### Metal Casting (Aluminum from Scrap)
Using a backyard foundry to cast tool parts, replacement fittings.

**Build: The Mini-Forge Foundry (Propane or Charcoal)**
*Materials*: A steel bucket, ceramic fiber blanket (Kaowool) or a refractory mix of perlite/grog/fireclay, a crucible (steel pipe with welded bottom), long lifting tongs.
1. **Insulate bucket**: Line with 2 inches of refractory. Let cure.
2. **Lid**: Same material with a vent hole.
3. **Burner**: If propane, build a Venturi burner from pipe. For charcoal, use a hair dryer blast.
4. **Crucible**: Made from heavy-walled steel pipe with lifting lug.
5. **Melting**: Melt aluminum cans (remove any liquid). Pour into green sand molds (sand + bentonite clay + water). *Safety: full face shield, leather apron, dry sand molds (explosion risk from moisture).*

**Expanded notes**
**Moisture is the enemy.** Any water trapped in a mold, crucible, or scrap metal will flash to steam and explode molten aluminum. Pre-heat all metal and molds to at least 120°C (250°F) before pouring. **Never pour aluminum into a wet or damp mold.**

**Green sand recipe:** 90% fine sand (play sand or sifted river sand), 10% bentonite clay, and just enough water to make the sand clump when squeezed. Too much water causes steam explosions; too little and the mold crumbles. Molds should be rammed firmly and vented with a small wire to allow steam to escape.

### N

#### Navigation Without GPS
*Shadow-tip method*: Place stick in ground, mark tip of shadow; after 15 mins, second mark. Line is east-west. North perpendicular. *At night*, find Polaris via Big Dipper. *Southern hemisphere*: Southern Cross and pointers. Dead reckoning with pace beads.

**Expanded notes**
**See Part III for the full old-school navigation guide.** The shadow-tip method is the foundation. Additional detail: the first shadow mark is always *west*, the second is *east* (in the northern hemisphere, the sun moves east to west, so the shadow moves west to east). The line between the marks is an east-west line; north is perpendicular, toward the direction of the shortest shadow. At night, Polaris is found by extending the pointer stars of the Big Dipper (Dubhe and Merak) five times the distance between them.

#### Net Making
**Build: Gill Net from Cordage**
*Materials*: Netting needle and gauge stick, twine.
1. Tie a series of loops on a foundation line.
2. Using sheet bend, create new row of meshes. Size of gauge determines mesh. A 50-ft net can be made from inner bark cordage. Excellent for passive fishing.

**Expanded notes**
The gill net is a passive protein source. **Mesh size determines catch:** a 2-inch mesh catches small fish; a 4-inch mesh catches larger fish. The net should be set perpendicular to the current, with the top edge floating and the bottom edge weighted. Check at dawn and dusk; fish caught in gill nets drown and spoil quickly in warm water.

### O

#### Ollas (Irrigation)
Unglazed clay pot buried in garden, filled with water, which seeps slowly through porous walls.

**Build: Homemade Ollas from Terracotta Pots**
*Materials*: Two terracotta pots (same diameter), silicone caulk or cement, a cork or flat stone.
1. Seal the drainage hole of one pot with silicone (food-grade).
2. Glue the rims of the two pots together with waterproof cement or silicone, creating a gourd shape. Let cure.
3. Bury the olla up to its neck among plants. Fill with water, cover top. Roots grow towards moisture. Reduces water use by 70%.

**Expanded notes**
Ollas are unglazed clay pots buried to the neck and filled with water. Water seeps through the porous walls into the surrounding soil, where roots grow toward the moisture. **The key to success is the clay:** terracotta pots work, but they must be **unglazed** and **fired at low temperature** (earthenware). High-fired stoneware is too dense to seep. Seal the drainage hole with food-grade silicone or a cork. In sandy soil, wrap the olla in a layer of compost or clay to slow seepage; in clay soil, add sand around the olla to improve drainage.

### P

#### Paper & Ink Making
Record keeping, map drawing. **Paper**: Soak plant fibers (rags, grass, inner bark), beat into pulp, slurry in vat, lift with mould and deckle, couche onto felt, press and dry. **Ink**: Boil soot (lampblack) with gum arabic (or hide glue) and water, or iron-gall ink from oak galls and iron sulfate.

**Expanded notes**
**Paper:** The fiber source matters. Rags (cotton or linen) produce the best paper; grass and bark produce coarser paper. Beat the fiber into a pulp with a wooden mallet or a blender (if power is available). The pulp should be a thin slurry, not a paste. Lift the pulp on a screen (mould) and press between felts to remove water. Dry under weight to prevent curling.

**Ink:** Iron-gall ink is permanent and dark. Boil oak galls (the round growths on oak twigs) in water, strain, and add iron sulfate (green vitriol) and gum arabic. The ink darkens as it oxidizes. **Warning:** iron-gall ink is acidic and will corrode steel pens over time; use a quill or a glass pen.

#### Pemmican
Ultimate survival food: dried lean meat (jerky) pounded to powder, mixed 50/50 with rendered fat, dried berries optional. Store in cakes; lasts decades.

**Expanded notes**
Pemmican is the highest-calorie-per-weight survival food. **Ratio:** 50% dried meat powder, 50% rendered fat by weight. The meat must be **bone-dry** (jerky that snaps when bent) and pounded into a powder. The fat must be **rendered and purified** (no water, no meat particles). Mix the powder and fat while the fat is warm but not hot. Add dried berries (blueberries, cranberries) for flavor and vitamin C. Pack into cakes or stuff into intestine casings. **Store in a cool, dark place;** pemmican kept dry and sealed can last for decades.

#### Plow (Turning the Soil)
Build a wooden ard plow from a forked branch, with iron share forged from scrap. Pulled by humans or draft animals. Basic design: beam, stilt, share, coulter.

**Expanded notes**
The ard plow is an ancient design that scratches a furrow without inverting the soil. **The key components:** beam (pulled by animal or human), stilt (handle for guiding), share (the cutting blade, forged from scrap iron), and coulter (a vertical knife that cuts the soil ahead of the share). The share must be **hardened and sharpened** (see Quenching & Tempering). A dull share requires vastly more pulling force.

#### Pottery (Coil and Pit Firing)
1. **Clay** processing: Dry, crush, slake in water, strain to remove grit, dry to plastic state.
2. **Coil building**: Roll coils, layer them, smooth with rib.
3. **Burnishing**: Rub with smooth stone to compress surface.
4. **Firing**: Dry greenware thoroughly. Build a pit fire with sawdust and dung, layer pots, cover, fire slowly for 8–12 hours. Yield low-fire earthenware. For water-tightness, pine pitch lining.

**Expanded notes**
**Clay processing:** Dry the clay, crush it, and slake it in water. Strain through a coarse cloth to remove grit and stones. Let the clay settle, pour off the water, and dry to a plastic consistency (like stiff cookie dough). **Wedging** (kneading) removes air pockets that cause explosions in the fire.

**Coil building:** Roll coils of uniform thickness (about the diameter of your thumb). Score and slip (wet clay slurry) the joint between coils. Smooth the interior and exterior with a rib (a curved wooden or gourd tool).

**Pit firing:** Dig a shallow pit, line with dry stones (not river stones), and build a bed of sawdust and dung. Layer the pots (bone-dry) with more fuel. Cover with larger pieces of wood and then with earth, leaving a small vent. Fire for 8–12 hours, then allow to cool completely before uncovering. **Do not open the pit while hot**; thermal shock will crack the pots.

#### Preserving Meat (Salt & Sugar Cure)
Dry cure: 1 lb salt, 2 oz sugar, 0.5 oz pink curing salt #1 per 25 lbs meat. Rub, pack tightly in crock, weight down, flip daily for a week, then hang to dry. Or smoke.

**Expanded notes**
**Dry cure ratio:** 1 lb salt, 2 oz sugar, 1 oz pink curing salt #1 per 25 lbs meat. The pink salt (sodium nitrite) prevents *Clostridium botulinum* and is **not optional** for long-cured meats. Rub the cure into every surface, pack tightly in a non-reactive crock (glass, ceramic, or food-grade plastic), and weight down. **Flip the meat daily** and rub with the accumulated brine. After 7 days per inch of thickness, remove, rinse, and hang to dry in a cool, breezy place. **Equilibrium curing** (vacuum-sealed or bagged) is more forgiving; use 2.5% salt and 0.25% pink salt by weight of meat.

### Q

#### Quenching & Tempering (Tool Heat Treatment)
To harden steel: heat to non-magnetic (cherry red), quench in warm oil or water (depending on steel). Temper to straw color for cutting tools (oven at 350°F for 1 hour). Always test with file.

**Expanded notes**
**Hardening:** Heat steel to its **critical temperature**—the point where it becomes non-magnetic (cherry red, roughly 750–800°C for simple carbon steel). Hold at that temperature until the color is uniform, then quench. **Quench medium:** Water for simple high-carbon steel (fast quench, risk of cracking); warm oil (canola, peanut, or commercial quench oil) for alloy steels and thin sections (slower, safer).

**Tempering:** After quenching, the steel is hard but brittle. Temper immediately (within hours) to relieve stress. **Color chart:**

| Color | Temperature | Use |
|---|---|---|
| Pale straw | 200°C (390°F) | Razors, fine cutting edges |
| Straw | 220°C (430°F) | Knives, chisels |
| Brown | 240°C (465°F) | Axes, heavy choppers |
| Purple | 280°C (535°F) | Springs, saw blades |
| Blue | 300°C (570°F) | Flexible tools, swords |

Temper in an oven or over a low flame, watching the oxide colors run. Quench again when the desired color is reached to stop the tempering process.

### R

#### Rainwater Harvesting (First Flush System)
**Build: Roof Catchment with Filtration**
*Materials*: Corrugated metal or tarp roofing, gutters, downspout, a first flush diverter (vertical PVC pipe with ball float), screen, storage tank (food-grade barrel or cistern).
1. Install gutters sloped to downspout.
2. First flush: Use a 6-inch diameter PVC pipe, length sized to divert first 1–2 gallons per 100 sq ft roof. A floating ball seals the pipe once full, clean water then goes to tank.
3. Filter incoming water through layers of gravel, sand, and charcoal in a separate drum, then store in dark tank. Treat with a few drops of bleach if drinking.

**Expanded notes**
The first-flush diverter is essential; bird droppings and dust contaminate the first 1–2 gallons per 100 sq ft of roof. **A simple diverter:** a vertical PVC pipe with a ball float. Water fills the pipe; when the ball rises to the top, it seals the pipe and forces subsequent water to the storage tank. A slow leak (a pinhole) drains the diverter between rains so it is ready for the next event.

**Filtration:** Pre-filter through a cloth to remove leaves and debris. Then filter through a bio-sand filter (see Water Filter) or a layered bucket filter (gravel, coarse sand, charcoal, fine sand). **Disinfection:** For drinking, add 8 drops of 6% unscented bleach per gallon (or 2 drops per liter), wait 30 minutes, and check for a slight chlorine smell. If none, add another 2 drops per gallon and wait 15 minutes. **SODIS:** Clear plastic bottles filled with filtered water and exposed to direct sun for 6 hours (or 2 days in cloudy conditions) will be disinfected by UV and heat.

#### Root Cellar
Underground storage maintaining 32–40°F and high humidity.

**Build: Buried Shipping Container or Dugout**
1. Excavate into a north-facing slope. Floor at least 4 ft below frost line.
2. Walls of stone, concrete, or pressure-treated wood. Ceiling heavily insulated.
3. Ventilation: two pipes, one intake near floor, one exhaust near ceiling to allow cold air circulation.
4. Shelves for root crops in sand, hanging cured meats, canning jars.

**Expanded notes**
**Temperature and humidity:**

| Crop | Ideal temp | Ideal humidity | Storage life |
|---|---|---|---|
| Potatoes | 40–45°F | 90–95% | 4–6 months |
| Carrots | 32–40°F | 90–95% | 4–6 months |
| Onions | 35–40°F | 65–70% | 3–4 months |
| Winter squash | 50–55°F | 60–70% | 3–6 months |
| Apples | 32–40°F | 85–90% | 3–5 months |
| Cabbage | 32–40°F | 90–95% | 3–4 months |

**Construction essentials:** Excavate into a north-facing slope (for drainage and coolness). Floor at least 4 feet below frost line. Insulate the ceiling heavily (straw bales, rigid foam, or earth). **Two ventilation pipes:** one intake near the floor, one exhaust near the ceiling. In winter, open vents at night to admit cold air; close during the day. In summer, keep closed. Monitor with a thermometer and hygrometer; adjust by venting or adding moisture (a pan of water) as needed.

### S

#### Still for Water – See *Distillation*

#### Sanitation (Composting Toilet)
In long-term survival, human waste must be safely composted to avoid disease.
**Build: Moldering Toilet**
*Materials*: 5-gallon bucket, toilet seat lid, sawdust or dry carbon material.
1. Separate urine if possible (urine diversion) to reduce odor.
2. After each use, cover deposit with sawdust, wood ash, or crushed dry leaves.
3. Empty full bucket into a designated thermophilic compost bin (at least 1 cubic yard) layered with straw, let age for 1–2 years for pathogen kill. Only use on non-food trees.

**Expanded notes**
The moldering toilet is safe **only if managed correctly.** The critical rules:
1. **Separate urine.** Urine is sterile (in a healthy person) and can be diluted 10:1 and used as fertilizer. Keeping it out of the compost pile reduces odor and moisture.
2. **Cover every deposit with carbon material** (sawdust, dry leaves, shredded paper, wood ash). The carbon-to-nitrogen ratio should be roughly 30:1. A bucket of sawdust kept beside the toilet is essential.
3. **Compost thermophilically.** The pile must reach 130–160°F for at least 3 consecutive days to kill pathogens. Turn the pile when it cools; if it does not heat, add nitrogen (green material) and moisture.
4. **Age for 1–2 years** before using on any food crops. Use only on non-food trees, ornamental plants, or cover crops that will be tilled under.
5. **Never use fresh humanure on root crops or leafy greens.**

#### Smokehouse (Cold & Hot Smoking)
Preserve meat/fish.

**Build: Smokehouse from a Barrel or Wood Shed**
*Materials*: 55-gallon drum or wooden box, firebox (small metal box), pipe/stovepipe connecting firebox to chamber.
1. **Firebox**: Burn hardwood chunks/sawdust at a distance, pipe carries cool smoke to chamber.
2. **Chamber**: Hang meat on racks. Cold smoke (below 90°F) for days for preservation; hot smoke (165°F+) cooks and flavors.
3. Control air with dampers.

**Expanded notes**
**Cold smoking** (below 90°F) preserves meat by depositing antimicrobial compounds and drying the surface. It requires **curing first** (salt or brine) to inhibit bacteria. **Hot smoking** (165°F+) cooks the meat and is a form of cooking, not long-term preservation unless combined with curing and drying.

**Smokehouse design:** The firebox is separate from the smoke chamber; smoke travels through a pipe, cooling as it goes. This prevents tar and creosote from depositing on the meat. Use **hardwood** (hickory, oak, apple, cherry); never use resinous softwoods (pine, fir) which produce bitter, toxic smoke. Control airflow with dampers; a smoldering fire produces more smoke than a flaming fire.

#### Soap Making (Cold Process)
Lye from hardwood ash: Leach water through ash to obtain brown potassium hydroxide solution (potash). Boil with rendered fat, stir until trace, pour into mold. Result is soft soap; add salt to harden. More precise: use sodium hydroxide (crystals from drain cleaner, 100% lye) with precise oil amounts. **Basic recipe**: 16 oz olive oil, 2.1 oz lye, 4.5 oz water. *Always add lye to water, not reverse, with gloves and goggles.* Stir, mold, cut, cure 4 weeks.

**Expanded notes**
**Lye safety is paramount.** Lye (sodium hydroxide) causes severe chemical burns and blindness. Wear gloves and goggles. **Always add lye to water, never water to lye**—the reaction is exothermic and can boil violently.

**Basic recipe (by weight):** 16 oz olive oil, 2.1 oz lye, 4.5 oz distilled water. This produces a soft, mild soap. For a harder bar, replace some olive oil with coconut oil (which increases lather) or lard (which increases hardness). **Trace:** Stir until the mixture thickens to the consistency of pudding. Pour into a mold (a wooden box lined with parchment). Cover and insulate for 24 hours. Unmold, cut, and cure for 4 weeks in a dry, ventilated place. **Cure time is not optional**; uncured soap is caustic.

**Ash lye (potash):** Leach water through hardwood ash to obtain a brown potassium hydroxide solution. This is imprecise; test by floating an egg—if a 1-inch patch of shell shows above the surface, the lye is strong enough. Boil with rendered fat until trace. The result is soft soap; add salt to "salt out" the soap, which hardens it.

#### Solar Dehydrator
Sun-powered food dryer.
**Build**: Wooden box with glass top, vent holes bottom and top. Screened trays. Black metal absorber plate. Sun heats air, rises through trays. Dry fruits, jerky.

**Expanded notes**
**See Part II, section 2.3, for the full food-drying guide.** A sun-powered food dryer: a shaded-top box with a black absorber, screened trays, and a vent at the top and bottom so warm air rises through the food. Dry until brittle (below 10% moisture) before storing.

#### Stitching & Repair (Awl and Speedy Stitch)
Leather and heavy canvas: use a stitching awl with lock-stitch. Drill holes if needed. Seam sealing with pine pitch and beeswax.

**Expanded notes**
The stitching awl with a lock-stitch is the most versatile leather repair tool. **Lock-stitch mechanics:** the awl pushes through the leather, a hook catches the thread on the far side, and the return stroke locks the stitch. This creates a stitch that will not unravel if one thread breaks. **Seam sealing:** pine pitch and beeswax melted together (1:1) makes a waterproof seam sealer. Apply warm with a stick; it hardens as it cools.

### T

#### Tool Handles (Re-handling an Axe)
Shaping a hickory blank: using drawknife and spokeshave, fit to eye with careful tapering. Secure with a wooden wedge and metal cross wedge. Soak head in water to swell.

**Expanded notes**
**Hickory is the gold standard** for axe handles. The grain must run parallel to the length of the handle; a diagonal grain will break under impact. Shape the handle with a drawknife and spokeshave, fitting it to the eye with a **tapered fit**—tight at the top, slightly loose at the bottom. Drive a wooden wedge into the top of the handle (parallel to the grain of the eye), then a metal cross-wedge perpendicular to it. **Do not soak the head in water** to swell the wood; this causes rot and loosens the fit when it dries. Instead, oil the handle with linseed oil and store in a dry place.

#### Treadle Lathe (Foot-Powered Woodturning)
**Build**: A frame of 2x4s, a flywheel (bicycle wheel or heavy disk), a belt to a spindle, and a treadle. Use bungee cord to return. Operate by pumping foot, spinning workpiece between centers. Tool rest adjustable. Turn bowls, chair legs, tool handles with forged gouges.

**Expanded notes**
The treadle lathe is a human-powered machine that can turn bowls, tool handles, and chair legs. **The flywheel is the key:** a heavy wheel (a bicycle wheel with a rim weighted with lead, or a heavy wooden disk) stores momentum and smooths the intermittent power from the treadle. **Bungee return:** a bungee cord or spring returns the treadle to the top of its stroke. **Tool rest:** must be adjustable and rigid; a vibrating tool rest makes clean cuts impossible. Start with green wood (easier to cut) and finish with a sharp gouge and scraper.

### U

#### Underground Shelter (Pithouse)
Partly dug into ground with log roof covered in earth. Excavate 3–4 ft, build walls of logs, roof of poles, layer of grass and thick dirt. Entrance with angled steps. Excellent insulation, low profile. Requires drainage ditch around.

**Expanded notes**
The pithouse is an excellent insulated shelter. **Drainage is the most important detail:** dig a ditch around the perimeter, uphill side, to divert surface water. The roof must be **layered:** poles, then a thick layer of grass or straw, then a layer of earth (6–12 inches). A **living roof** (sod) adds insulation and camouflage. The entrance should be an angled tunnel with steps, ideally with a **cold trap** (a low point where cold air settles) to keep freezing air out of the living space.

### V

#### Venomous Snake Bite
Keep calm, immobilize bitten limb, remove jewelry, do NOT cut or suck. Apply pressure immobilization bandage (wrap entire limb firmly, not a tourniquet). Seek antivenom if possible. Identify snake from safe distance.

**Expanded notes**
**The pressure immobilization bandage is the only field treatment that buys time.** Wrap the entire bitten limb firmly (not a tourniquet) with an elastic bandage, starting at the bite and working toward the heart. The bandage should be tight enough to compress lymphatic flow but not so tight that it cuts off arterial circulation (you should still feel a pulse below the bandage). **Immobilize the limb** with a splint. Keep the victim calm and still; exertion speeds venom circulation. **Do not cut, suck, or apply ice.** Identify the snake from a safe distance (color, pattern, head shape) to guide antivenom selection. Evacuate as quickly as safely possible.

### W

#### Windmill (DIY Wind Turbine) – See *Electricity*, but mechanical windpump: multi-blade fan connected to a reciprocating pump rod via crank. Classic farm water pumper.

#### Water Filter (Ceramic & Charcoal Gravity Filter)
**Build: Bucket Bio-Sand Filter**
*Materials*: Two 5-gallon buckets, fine sand, coarse sand, gravel, activated charcoal (homemade from charred wood/hardwood, crushed), a ceramic filter candle if available.
1. Drill holes in bottom of upper bucket. Layer from bottom: cloth, then 2 inches gravel, 4 inches fine sand, 4 inches activated charcoal, 4 inches coarse sand, 2 inches gravel. Top with a diffuser plate.
2. Upper bucket sits on lower bucket with spigot. Pour water slowly; filtered water collects. Pre-filter turbid water through cloth. For microbiological safety, after filtering add 8 drops of 6% bleach per gallon, wait 30 mins, or solar disinfect (SODIS): clear plastic bottles in direct sun 6 hours.

**Expanded notes**
The bio-sand filter is effective against bacteria and protozoa but **not against viruses or dissolved chemicals.** Layering from bottom to top: cloth, 2 inches gravel, 4 inches fine sand, 4 inches activated charcoal, 4 inches coarse sand, 2 inches gravel. **Flow rate matters:** water should drip through, not pour. If it flows too fast, the sand is too coarse or the layer is too thin. **Charcoal activation:** homemade charcoal from hardwood is not truly "activated" (it lacks the high surface area of steam-activated carbon), but it still adsorbs some chemicals and improves taste. Replace the charcoal layer every 3–6 months.

#### Water Lifting (Rope Pump for Well)
Simple pump using PVC pipe, rope with rubber washers spaced every foot, and a pulley at the top. As you crank, washers pull water up. Easy to build from scavenged materials.

**Expanded notes**
The rope pump is simple and repairable. **Washers** (rubber disks) spaced every foot on a rope, running through a PVC pipe, lift water as the rope is pulled. **The key is the seal:** the washers must fit snugly enough to lift water but loosely enough to pass over the pulley at the top and through the pipe. A **foot valve** at the bottom prevents water from draining back when the rope stops. This pump can lift water from 20–30 feet with modest effort.

#### Water Wheel (Undershot for Mechanical Power)
**Build**: A wooden wheel 4-6 ft diameter with paddles, mounted on an axle over a flowing stream. Use belt pulley to drive grain mill, generator, or workshop. Axle of steel pipe, bearings of greased hardwood. Gearing from bicycle parts. Water velocity required ~2 ft/s.

**Expanded notes**
An undershot wheel is the simplest water wheel: the paddles dip into the flowing stream and are pushed by the current. **Efficiency is low (20–30%)** compared to overshot wheels, but it requires no dam or flume. **Wheel diameter:** 4–6 feet; paddle depth: 6–12 inches; paddle spacing: equal to paddle depth. **Axle:** a steel pipe with greased hardwood bearings. **Gearing:** a bicycle chain and sprockets can multiply speed for a generator or grain mill. Required stream velocity: about 2 ft/s.

#### Weaving (Inkle Loom for Straps)
Warp-faced weaving for belts, straps, slings. Build frame with pegs. Warp threads arranged, heddles made from string. Shuttle passes weft. Compact and strong.

**Expanded notes**
The inkle loom produces warp-faced bands—strong, dense, and perfect for belts, straps, and slings. **Warp:** strong cotton or linen thread, tensioned between pegs. **Heddles:** string loops that lift selected warp threads to create the shed. **Weft:** heavier thread, beaten firmly into place. The pattern is determined by the order of warp threads through the heddles. A 2-inch-wide band can support a person's weight.

### Y

#### Yeast Cultivation (Wild Sourdough Starter)
Mix flour and water, let sit in warm place, feed daily. Captures wild yeasts and bacteria. Used for leavening bread and fermenting beverages. Sanitize everything.

**Expanded notes**
**Wild yeast is everywhere.** Mix equal weights of flour and water (by weight, not volume) in a jar. Stir vigorously. Cover loosely and leave at room temperature (70–80°F). **Feed daily** with equal weights of flour and water, discarding half the starter each time. Within 5–10 days, the starter will bubble, rise, and smell pleasantly sour. **If it turns pink or orange, or smells like nail polish remover, discard and start over.** A healthy starter is a living culture; once established, it can last indefinitely with weekly feeding (store in the refrigerator if you have one, or feed twice daily at room temperature).

### Z

#### Zinc-Air Battery (Emergency Power)
Create a simple battery from copper and zinc electrodes. Place strips of copper and zinc (or galvanized nail) in series cells with an electrolyte (saltwater, vinegar, or even urine), connected in series to produce a few volts to charge a small device or run an LED. Not practical for large loads but can spark a fire with steel wool.


*This encyclopedia is a living document. Each entry scratches the surface; deep mastery requires hands-on practice before disaster strikes. Build your skills now, share with your community, and when the old systems fail, you will not merely survive—you will thrive.*

**Expanded notes**
The zinc-air battery is a **primary (non-rechargeable) cell.** Zinc, air (oxygen), and an electrolyte (saltwater or potassium hydroxide) produce about 1.4V per cell. **Construction:** a zinc electrode (a galvanized nail or a strip of zinc), a carbon electrode (a graphite rod or a copper strip), and an electrolyte-soaked separator (paper towel soaked in saltwater). The carbon electrode is the positive terminal; the zinc is negative. **Limitations:** very low current; useful only for LEDs or a small radio. **Do not attempt to recharge;** zinc-air cells are not rechargeable and can leak or rupture.

### II | Food Production & Preservation

#### 2.1 Seasonal Planting Guide
**Determining your frost dates and zone**
Every planting decision hinges on two dates: the **average last spring frost** and the **average first fall frost.** These are not guarantees—they are the midpoint of a range. Your **USDA hardiness zone** tells you the average annual minimum winter temperature, which determines which perennials survive. Find your zone at planthardiness.ars.usda.gov and your frost dates from a local extension office or weather service. Write them on a calendar and plan backward and forward from them.

**The three planting categories**

| Category | When to plant | Examples | Frost tolerance |
|---|---|---|---|
| **Cool-season** | 2–4 weeks before last frost; again in late summer for fall | Lettuce, spinach, peas, radishes, broccoli, carrots, kale, onions | Tolerate light frost; bolt in heat |
| **Warm-season** | 2–4 weeks after last frost (soil ≥60°F) | Tomatoes, peppers, corn, beans, squash, cucumbers, melons | Killed by frost; need heat |
| **Overwintering** | Late summer/early fall; survive winter | Garlic, onions (some varieties), spinach, kale, cover crops | Hardy to varying degrees |

**Succession planting**
To harvest continuously rather than in a glut, plant small amounts every 2–3 weeks. Lettuce, radishes, beans, and carrots are ideal for succession. **Stop succession plantings 60–70 days before first frost** so the final crop matures before cold arrives.

**The planting calendar (by zone)**

| Zone | Last Frost (approx.) | First Frost (approx.) | Cool-season start | Warm-season transplant | Fall cool-season start |
|---|---|---|---|---|---|
| 3–4 | Late May–early June | Early–mid Sept | Early May | Early–mid June | Mid–late July |
| 5–6 | Mid–late April | Mid–late Oct | Late March–early April | Mid–late May | Late July–early Aug |
| 7–8 | Late March–mid April | Late Oct–mid Nov | Late Feb–mid March | Mid–late April | Mid–late Aug |
| 9–10 | Late Jan–late Feb | Late Nov–Dec | Late Jan–Feb | Late Feb–March | Sept–Oct |

**Succession intervals:** Lettuce every 2 weeks; radishes every 2 weeks; beans every 3 weeks; carrots every 3 weeks; beets every 3 weeks.

**The moon and planting**
Traditional planting calendars correlate with lunar phases: **root crops** (carrots, potatoes, onions) are planted in the waning moon (after full moon); **leafy and above-ground crops** in the waxing moon (new to full). The scientific evidence is weak, but the practice encourages careful observation and is harmless. **More important than moon phase:** soil temperature, moisture, and frost risk.

#### 2.2 Livestock Care and Butchering
**General principles**
**Humane slaughter is not merely ethical; it produces better meat.** Stress before slaughter depletes glycogen and causes dark, firm, dry meat in cattle and pale, soft, exudative meat in pigs. Handle animals calmly, minimize transport, and slaughter quickly. **The goal is immediate unconsciousness followed by rapid exsanguination (bleeding out).**

**Hygiene:** Clean water, clean knives, clean hands. Keep the carcass off the ground. Chill the carcass rapidly; bacteria multiply fastest between 40°F and 140°F. **Do not butcher a sick animal** unless you are trained to inspect for disease; zoonoses (diseases transmissible from animals to humans) are a real risk.

**Chickens**
**Slaughter:** The most humane method for a backyard chicken is **stunning followed by bleeding.** Hold the bird by the legs, place its head on a chopping block, and deliver a sharp, decisive blow to the back of the head with a heavy, blunt object (a broom handle or a purpose-made stunner). Immediately sever the jugular vein and carotid artery on one side of the neck with a sharp knife. Hold the bird upside down to bleed for 2–3 minutes.

**Scalding and plucking:** Heat water to **140–150°F** (not boiling; boiling water cooks the skin and causes tearing). Dunk the bird for 30–60 seconds, then pluck immediately. A **plucking machine** (a drum with rubber fingers) speeds the process, but hand-plucking is fine for a few birds.

**Evisceration:** Cut around the vent, being careful not to puncture the intestines. Open the body cavity and remove the organs. **Keep the liver, heart, and gizzard** (split the gizzard and remove the grit). **Do not rupture the gallbladder**—it contains bile that ruins the meat. Rinse the carcass thoroughly in cold water, chill immediately in ice water, and either cook or freeze within 2–3 days.

**Pigs**
**Slaughter:** Pigs are stunned with a **captive bolt** or a heavy blow to the forehead, then bled by severing the major vessels in the neck. **Scalding** (140–150°F water for 3–5 minutes) loosens the hair; scrape with a bell scraper or dull knife. Alternatively, **skin the pig** (faster, but loses the skin and some fat).

**Butchering:** A pig yields **primal cuts:** shoulder (Boston butt, picnic), loin (chops, tenderloin), belly (bacon), ham (fresh ham, prosciutto), and offal. **Rendering lard:** Cut fat into small pieces, heat slowly in a heavy pot until the fat melts and the cracklings float. Strain through cheesecloth. Lard is a critical survival fat; it keeps for months in a cool, dark place and can be sealed with a layer of salt.

**Curing:** **Dry-cured bacon:** rub with 2.5% salt, 1% sugar, and 0.25% pink salt by weight of meat. Cure for 7–10 days, turning daily. Rinse, dry, and cold-smoke. **Fresh sausage:** grind meat with 2% salt and spices; stuff into casings; cook or smoke immediately.

**Cattle**
**Slaughter:** Cattle require a **captive bolt stunner** or a firearm. The goal is to destroy the brainstem and render the animal instantly unconscious. Bleed immediately by severing the carotid arteries and jugular veins in the neck. **Hanging:** hoist the carcass by the hind legs and bleed out completely. **Skinning:** remove the hide carefully; the hide is valuable for leather. **Evisceration:** open the abdomen and remove the organs; **do not puncture the rumen** (the first stomach, which contains partially digested feed and bacteria).

**Aging:** Beef benefits from **dry aging** (hanging at 34–38°F for 14–28 days) or **wet aging** (vacuum-sealed for 14 days). Dry aging concentrates flavor and tenderizes; it requires precise temperature and humidity control. In a survival situation without refrigeration, **butcher and preserve immediately** (salt, smoke, can).

**Cuts:** A beef carcass yields **primals:** chuck, rib, loin, round, brisket, plate, flank, and shank. Learn the seams between muscles; a sharp knife and a knowledge of anatomy are more important than a saw.

**Horses**
**Note:** Horse slaughter for human consumption is **illegal in many countries** and culturally unacceptable in many others. This section is included for completeness, for the context of extreme survival where no alternative exists. **Check local law before acting.**

**Slaughter:** Horses are large and powerful; a captive bolt or firearm is required. The anatomy is similar to cattle but the digestive tract is different (horses are hindgut fermenters; the cecum is large and should not be punctured). **Bleeding:** sever the major vessels in the neck. **Skinning and butchering:** similar to cattle but with different muscle groups. Horse meat is lean and dark; it should be cooked thoroughly.

#### 2.3 Food Preservation Without Refrigeration
**The three pillars: storage, drying, canning**
**Storage** is the oldest method: a cool, dry, dark place with the right humidity. Root cellars (see Root Cellar) are the gold standard. **Drying** removes moisture below the threshold where bacteria and mold can grow (below 10% moisture for most foods). **Canning** uses heat to kill microorganisms and a vacuum seal to prevent recontamination.

**Canning: water bath vs. pressure**

| Method | Use for | Temperature | Time (example) |
|---|---|---|---|
| **Water bath** | High-acid foods (fruits, tomatoes with added acid, pickles, jams) | 212°F (100°C) | 10–85 minutes depending on food and altitude |
| **Pressure canner** | Low-acid foods (vegetables, meats, beans, soups) | 240°F (116°C) at 10 psi | 20–90 minutes depending on food and altitude |

**Altitude adjustment:** Water boils at lower temperatures at altitude. Above 1,000 feet, add 5 minutes to water-bath processing time for every 1,000 feet. For pressure canning, increase pressure by 1 psi per 2,000 feet above sea level (or follow the canner manufacturer's chart).

**Spoilage detection:** A sealed jar can still contain botulism toxin, which is odorless and tasteless. **Never taste a suspect jar.** Signs of spoilage: bulging lid, cloudy liquid, bubbles, off-odor, mold. **When in doubt, throw it out.** Boil all home-canned low-acid foods for 10 minutes before eating (this destroys botulism toxin, though not the spores).

**Smoking**
**Cold smoking** (below 90°F) preserves; **hot smoking** (165°F+) cooks. Cold smoking requires **curing first** (salt, sugar, pink salt) to inhibit bacteria. The smoke must be **cool** when it reaches the meat; a long pipe from firebox to chamber allows the smoke to cool and drop tar. **Hardwoods only** (hickory, oak, apple, cherry); softwoods produce resinous, bitter smoke.

**Salting and brining**
**Dry salting** draws moisture out of meat by osmosis. **Brine** (saltwater) works faster but requires a precise concentration. **Basic brine:** 1 cup salt per gallon of water (about 5% salinity). For long-term preservation, use **equilibrium brining:** submerge the meat in a brine calculated to reach 2.5–3% salt in the meat by weight. This requires weighing the meat and the brine.

**Fermentation**
**Lacto-fermentation** preserves vegetables through lactic acid bacteria. **Basic kraut:** 2% salt by weight of shredded cabbage. Massage the salt into the cabbage until it releases water, pack tightly into a jar, and weight the cabbage below the brine. Ferment at 65–75°F for 1–4 weeks. **The brine must cover the vegetables**; exposure to air causes mold. A healthy ferment smells sour and is bubbly; a pink or fuzzy surface indicates spoilage.

**Root cellaring and cool storage**
The root cellar is the backbone of winter food security. **See the Root Cellar entry for construction and temperature/humidity tables.** Additional preservation methods for specific crops:
- **Eggs:** Fresh, unwashed eggs (with the bloom intact) keep for months at 50–60°F. Coating eggs in mineral oil extends shelf life. **Water glass** (sodium silicate) preserves eggs for 6–12 months.
- **Apples:** Wrap individually in newspaper and store in a single layer; one rotten apple spoils the lot.
- **Potatoes:** Store in the dark; light causes greening (solanine, which is toxic). Do not store near apples (ethylene gas causes sprouting).
- **Onions and garlic:** Cure in a dry, breezy place for 2–3 weeks until the necks are dry and papery. Braid and hang.

### III | Navigation & Timekeeping

#### 3.1 Old-School Navigation (No Instruments)
**The shadow-tip method**
1. Place a straight stick vertically in level ground.
2. Mark the tip of its shadow with a pebble or scratch.
3. Wait 15–20 minutes. Mark the new shadow tip.
4. The line between the marks is **east–west** (first mark is west, second is east).
5. Stand with the first mark on your left and the second on your right: you are facing **north** (in the northern hemisphere). In the southern hemisphere, this gives you **south**.

**Accuracy:** This method is accurate to within a few degrees. It works anywhere the sun casts a shadow, regardless of season.

**Finding north at night (northern hemisphere)**
**Polaris (the North Star)** is nearly stationary in the sky. Find the **Big Dipper** (Ursa Major). The two stars at the end of the "bowl" (Dubhe and Merak) are the **pointer stars.** Draw a line from Merak through Dubhe and extend it about five times the distance between them. Polaris is at the end of that line. Polaris is less than 1° from true north.

**Cassiopeia** (the W-shaped constellation) is on the opposite side of Polaris from the Big Dipper. When the Dipper is low, use Cassiopeia to find Polaris.

**Southern hemisphere**
The **Southern Cross** (Crux) points toward the south celestial pole. Extend the long axis of the cross (the upright) about 4.5 times its length; the point where it meets the horizon is south. The **Pointers** (Alpha and Beta Centauri) help confirm the Cross.

**Sun compass (improvised)**
A **watch method** (analog watch, northern hemisphere): point the hour hand at the sun. The angle between the hour hand and 12 o'clock is bisected; the bisector points south. **Without a watch:** use the shadow-tip method.

**Sunstone (calcite):** A clear calcite crystal can locate the sun's polarization pattern even through thin clouds. This is an advanced technique; practice it before relying on it.

**Dead reckoning and pace count**
**Pace count:** Measure your pace (the distance of one full stride, left foot to left foot). On a known 100-foot course, count your paces. Average adult: 12–15 paces per 100 feet. Use **pace beads** (a cord with beads) to track distance: move one bead per 100 meters or 100 paces.

**Dead reckoning:** Start from a known point. Record your heading (compass or celestial) and distance traveled. Plot on paper. **Error accumulates;** update your position with landmarks whenever possible.

#### 3.2 Celestial Calendar
The sun, moon, and stars are a clock and a calendar. **Before GPS, every navigator and farmer read the sky.**

**The sun's annual motion**
The sun rises and sets at different points on the horizon throughout the year. The **solstices** (around June 21 and December 21) mark the extremes; the **equinoxes** (around March 20 and September 22) mark equal day and night. **The sun rises due east and sets due west only on the equinoxes.** Between the vernal equinox and the autumnal equinox, the sun rises north of east and sets north of west (long days in the northern hemisphere); between the autumnal and vernal equinoxes, it rises south of east and sets south of west.

**The moon's phases**
The moon completes a cycle every 29.5 days. **New moon:** dark; **waxing crescent:** right side lit (northern hemisphere); **first quarter:** right half lit; **waxing gibbous:** mostly lit; **full moon:** fully lit; **waning gibbous:** mostly lit, left side; **last quarter:** left half lit; **waning crescent:** left side lit. **The moon rises about 50 minutes later each day.** The phase predicts tides (important for coastal foraging) and provides night illumination.

**The stars as a calendar**
**The Big Dipper's position** tells the season and the time. In the northern hemisphere, the Dipper is high overhead in spring and low in autumn. **Orion** is prominent in winter evenings; **Scorpius** in summer. The **Pleiades** (Seven Sisters) rise in the east before dawn in late spring and are associated with the start of the agricultural season in many traditional cultures.

**Telling time by the stars**
The **Big Dipper's pointer stars** rotate around Polaris once every 24 hours (23 hours 56 minutes, to be precise). Imagine a clock face centered on Polaris, with **12 o'clock pointing to the vernal equinox** (a fixed point in the sky). The position of the pointer stars gives you **sidereal time**, which can be converted to solar time with a correction for the date. This is advanced; a simpler method is to use the **moon's position** relative to the horizon and the time of moonrise.

### IV | Energy & Communications

#### 4.1 Simple Generator Design
The simplest generator is a **Faraday generator:** a coil of wire and a moving magnet. **The output voltage depends on the number of turns, the strength of the magnet, and the speed of movement.** A hand-cranked generator using a salvaged treadmill motor (permanent magnet DC motor) can produce 12V at modest effort. **Bicycle generator:** mount a bicycle on a stand, connect the rear wheel to an alternator or a DC motor via a belt. A fit cyclist can produce 100–200W continuously.

**For a permanent installation:** a **PVC wind turbine** or a **stream micro-hydro** generator is more reliable than human power. **Wind turbine:** PVC blades (cut from pipe) mounted on a hub, connected to a permanent magnet alternator (a modified car alternator or a purpose-built axial flux alternator). **Micro-hydro:** a water wheel or a propeller in a stream, driving an alternator through a gear or belt. **Both require a charge controller and a dump load** (a resistive heater) to prevent overcharging the battery.

**The FIKGS (Fire-and-Iron Kinetic Generator System):** a thermomechanical generator that uses a heat source (fire) to drive a Stirling engine or a steam engine, which turns a generator. This is advanced and inefficient at small scale, but it can produce continuous power if you have fuel. The rebuild guide is freely available; study it carefully before attempting.

#### 4.2 Simple Radio Transmitter and Receiver
**Radio communication is the difference between isolation and community.** The simplest receiver is a **crystal radio:** an antenna, a tuned circuit (a coil and a variable capacitor), a germanium diode detector, and a high-impedance earphone. It requires **no power** and can receive strong AM stations. **Build:** wind 60 turns of wire on a toilet-paper tube, connect a 100pF variable capacitor across it, connect a germanium diode (1N34A) and a piezo earphone. A long wire antenna (30+ feet) and a good earth ground are essential.

**Simple transmitter:** A **Morse code transmitter** using a single transistor oscillator (e.g., a 2N2222) and a crystal (or a tuned LC circuit) can transmit CW (continuous wave) over several miles with a proper antenna. **Legal note:** Transmitting without a license is illegal in most countries. In a genuine emergency, emergency transmissions are often protected, but **do not interfere with emergency services.** Learn Morse code; it is the most reliable mode when signal is weak.

**Modern low-power options:** An **ESP32 walkie-talkie** (using ESP-NOW or UDP broadcast) can transmit voice over a few hundred meters without infrastructure. An **Arduino-based FM receiver** (TEA5767 module) can receive broadcast radio. **These require batteries and electronics skills,** but they are within reach of a determined maker.

#### 4.3 Earth Battery, Saltwater Cell, Electrolysis
**Earth battery (galvanic cell)**
**Principle:** Two dissimilar metals (copper and zinc) buried in moist soil create a galvanic cell. The soil acts as the electrolyte. **Voltage:** 0.5–1.0V per cell. **Current:** very low; useful only for LEDs or a small radio. **Build:** drive a copper rod and a zinc rod (or a galvanized nail) into moist soil about 6 inches apart. Connect a wire to each. **Increase voltage by connecting cells in series** (copper of one to zinc of the next). **Increase current by increasing electrode surface area** and soil moisture. **Earth batteries are not a practical power source;** they are a curiosity and a teaching tool.

**Atmospheric electricity**
The atmosphere carries a **vertical electric field** of about 100V per meter near the ground on a clear day. This field is strongest during thunderstorms. **A simple detector:** an antenna insulated from the ground, connected to a sensitive electrometer (or a FET-input op-amp circuit). **Harvesting atmospheric electricity at useful power levels is not practical with simple materials;** the currents are tiny. **Franklin's kite experiment** demonstrated the principle, but it is dangerous. **Do not attempt to harvest lightning energy;** the voltages and currents are lethal and uncontrollable.

**Saltwater battery**
A saltwater battery is a **galvanic cell** using saltwater as the electrolyte, copper as the cathode, and zinc (or aluminum) as the anode. **Voltage:** about 0.7–1.0V per cell. **Current:** depends on electrode area and salt concentration. **Build:** immerse copper and zinc strips in a container of strong saltwater (as much salt as will dissolve). Connect cells in series for higher voltage. **Limitations:** the zinc anode corrodes; the battery is not rechargeable. **Use:** emergency LED lighting, a small radio. **Do not use aluminum foil as an anode in saltwater;** it produces hydrogen gas and can be dangerous in a sealed container.

**Electrolysis (hydrogen and oxygen)**
**Electrolysis of water** splits H₂O into hydrogen and oxygen using electricity. **Build:** two electrodes (platinum or carbon/graphite; stainless steel works but produces chromium compounds) immersed in water with an electrolyte (baking soda or salt—**salt produces chlorine gas, which is toxic; use baking soda**). Apply DC current (a battery or solar panel). **Hydrogen** collects at the cathode (negative electrode); **oxygen** at the anode. **Safety:** hydrogen is highly flammable and explosive. **Do not store hydrogen in improvised containers.** This is a demonstration, not a practical fuel source for survival unless you have a fuel cell (which you probably don't).

#### 4.4 Heating and Cooling Without Power or Wood
**Passive heating**
**Thermal mass:** Adobe, stone, concrete, and water absorb heat during the day and release it at night. **Trombe wall:** a south-facing wall of thermal mass (masonry or water containers) behind glass. Sunlight passes through the glass, heats the mass, and the heat radiates inward. Vents at the top and bottom create a convection loop.

**Earth sheltering:** Building into a south-facing slope (with proper drainage) uses the earth's stable temperature. **Pithouses and earthships** are examples. **Insulation** is critical; without it, thermal mass works against you in cold climates.

**Body heat:** A single adult produces about 100W of heat. **A small, well-insulated room** (a "survival pod") can be heated by body heat alone if the volume is small enough (e.g., 100 cubic feet) and insulation is adequate.

**Passive cooling**
**Wind catchers (badgir):** A tall tower on the windward side of a building captures breezes and funnels them down. **The air can be directed over a pool of water** for evaporative cooling. This is the traditional cooling method of Persian and Middle Eastern architecture.

**Evaporative cooling (swamp cooler):** Air is drawn through a wet pad (burlap, straw, or a porous ceramic). Evaporation absorbs heat. **Effective only in dry climates;** in humid climates, evaporation is slow and cooling is minimal.

**Radiative cooling:** At night, a surface exposed to the clear sky radiates heat into space and can drop below ambient temperature. **A shallow pan of water** on a clear night can cool to 40–50°F even in summer. **Dew collection** uses this principle (see 4.5).

**Earth tubes (cooling tubes):** Buried pipes draw air through the soil, which is cooler than the surface in summer. **Requires a slope or a fan;** condensation in the pipe can be a problem.

#### 4.5 Moisture Collection via Condensation
**Dew collection**
**Principle:** A surface that cools below the dew point at night causes water vapor to condense. **Ancient stone piles** in the Negev and other deserts collected dew; the stones cooled rapidly at night, and water dripped into collection channels. **Modern equivalent:** a **fog fence** (a mesh net) intercepts fog droplets, which coalesce and drip into a trough. **Dew pond:** a shallow, insulated pond covered with a clear plastic sheet; water condenses on the underside of the sheet and runs into a collection channel.

**Solar still (pit type)**
The original instructions are correct. **Improvements:**
- Line the pit with **black plastic** to absorb more solar heat.
- Add **green vegetation** around the collection container (the vegetation releases moisture as it heats).
- Place the still in **full sun** with the plastic sheet stretched tight and weighted in the center.
- **Yield:** 1–2 liters per day in good conditions. In arid climates, a **vegetation still** (a plastic bag over a leafy branch) can supplement.

**Transpiration bag**
Tie a clear plastic bag over a leafy branch of a non-toxic tree. The leaves transpire water vapor, which condenses on the bag and collects in the bottom. **Yield:** up to 1 liter per day from a large branch. **Do not use toxic plants** (e.g., oleander, poison oak).

**Atmospheric water harvesting (advanced)**
**Metal-organic frameworks (MOFs)** and **desiccant-based harvesters** can extract water from desert air, but they require advanced materials. **A simple desiccant harvester:** place a tray of **silica gel** or **calcium chloride** (from road salt) in a humid area overnight; it absorbs moisture. In the morning, seal the desiccant in a container with a collection cup and heat it in the sun; the water vapor drives off and condenses. **Calcium chloride is corrosive;** handle with care.

### V | Natural Health Care

#### 5.1 The Framework
**Disclaimer:** This guide is for informational purposes in a grid-down scenario where professional medical care is unavailable. It does not replace professional medical advice. **Seek professional care whenever possible.** Herbs are drugs; they interact with medications and can be toxic in excess.

**The body heals itself.** Most minor ailments resolve with rest, hydration, and nutrition. The role of the caregiver is to **support the body's defenses, prevent complications, and recognize when a condition is beyond field treatment.** **Red flags requiring evacuation or urgent care:** difficulty breathing, chest pain, uncontrolled bleeding, loss of consciousness, severe dehydration, high fever with stiff neck, signs of sepsis (rapid heart rate, confusion, cold extremities), and any wound that is deep, dirty, or on the hands/face/joints.

#### 5.2 Common Ailments and Natural Remedies

| Ailment | Symptoms | Natural remedies | Notes |
|---|---|---|---|
| **Cuts and scrapes** | Bleeding, pain, risk of infection | Yarrow poultice (styptic); plantain poultice (anti-inflammatory, antimicrobial); honey (osmotic, antibacterial) | Clean the wound with boiled (cooled) water or saline. Honey dressings are effective for infected wounds. |
| **Burns** | Redness, pain, blistering | Cool water (15–20 min); honey; aloe vera gel; calendula salve | **Do not apply ice.** Do not break blisters. Seek care for large or deep burns. |
| **Insect bites/stings** | Local pain, swelling, itching | Plantain poultice; mud; cold compress; baking soda paste | Remove stingers by scraping (not squeezing). Watch for signs of anaphylaxis (swelling of face/throat, difficulty breathing). |
| **Fever** | Elevated temperature, chills, sweating | Yarrow tea (diaphoretic); elderflower tea; cool compresses; hydration | Fever is a defense mechanism. Treat the person, not the number. Seek care if fever exceeds 103°F (39.4°C) or lasts more than 3 days. |
| **Cough and cold** | Runny nose, congestion, sore throat, cough | Elderberry syrup (antiviral); ginger tea (anti-inflammatory); honey and lemon; steam inhalation | Elderberry is most effective at the first sign of illness. **Do not give honey to infants under 1 year.** |
| **Sore throat** | Pain, difficulty swallowing | Saltwater gargle (1/2 tsp salt per cup warm water); sage tea; honey | Check for white patches (strep) or difficulty breathing. |
| **Diarrhea** | Loose stools, dehydration risk | Oral rehydration solution (ORS): 1 liter water + 6 tsp sugar + 1/2 tsp salt; slippery elm bark; blackberry leaf tea | **ORS is the most important intervention.** Dehydration kills. Seek care if there is blood in stool or signs of severe dehydration (sunken eyes, no urine). |
| **Constipation** | Infrequent stools, straining | Fiber (psyllium, flaxseed); prune juice; dandelion root tea; hydration | Rule out impaction. |
| **Headache** | Pain in head, tension | Willow bark tea (salicin); peppermint oil (topical, temples); hydration; rest | **Do not give willow bark to children or people with aspirin allergy.** Sudden severe headache ("thunderclap") requires urgent care. |
| **Nausea** | Queasiness, vomiting | Ginger tea or candied ginger; peppermint tea; small sips of ORS | Ginger has good evidence for nausea. |
| **Muscle aches/sprains** | Pain, swelling, limited motion | RICE (rest, ice, compression, elevation); arnica salve; willow bark | Ice for first 48 hours, then heat. |
| **Minor infections (skin)** | Redness, warmth, pus | Warm compress; honey; garlic poultice (antimicrobial); echinacea tincture (immune support) | **Watch for spreading redness or red streaks** (lymphangitis), which require antibiotics. |
| **Insomnia** | Difficulty falling/staying asleep | Chamomile tea; valerian root; lavender; sleep hygiene (dark, cool, quiet) | Valerian can cause drowsiness; do not combine with alcohol. |
| **Anxiety/stress** | Restlessness, worry, rapid heartbeat | Lemon balm tea; passionflower; chamomile; breathing exercises | These are supportive, not curative. |
| **Menstrual cramps** | Pelvic pain, cramping | Ginger tea; cramp bark; warm compress; raspberry leaf tea | Ginger has evidence for menstrual pain. |
| **Fungal infections (skin)** | Itching, redness, scaling | Tea tree oil (diluted); garlic; apple cider vinegar (diluted) | Keep the area dry. |

#### 5.3 Preparing Herbal Remedies
**Infusion (tea):** Pour boiling water over dried or fresh herbs (1 tsp dried herb per cup), cover, and steep 10–15 minutes. Strain.

**Decoction:** Simmer tougher plant parts (roots, bark, seeds) in water for 15–30 minutes. Strain.

**Tincture:** 1 part dried herb to 5 parts 40–50% alcohol (vodka or homemade ethanol). Macerate for 4–6 weeks in a sealed jar, shaking daily. Strain and store in amber dropper bottles. **Dose:** typically 1–3 droppersful, 2–3 times daily.

**Salve:** Infuse herbs in oil (olive or sunflower) for 4–6 weeks in a warm place, then strain. Melt with beeswax (1 part beeswax to 4 parts oil) and pour into tins.

**Poultice:** Crush fresh herbs or rehydrate dried herbs with hot water. Apply directly to the skin, cover with a cloth, and secure. Change every 2–4 hours.

#### 5.4 The Apothecary Garden

| Herb | Primary uses | Growing notes |
|---|---|---|
| Yarrow | Styptic, fever, wounds | Hardy perennial; full sun; drought-tolerant |
| Plantain | Bites, stings, wounds | Common weed; grows anywhere |
| Calendula | Skin healing, burns | Annual; full sun; self-seeds |
| Chamomile | Sleep, digestion, anxiety | Annual; full sun; delicate |
| Peppermint | Nausea, headache, digestion | Perennial; spreads aggressively—contain it |
| Sage | Sore throat, mouthwash | Perennial; full sun; drought-tolerant |
| Thyme | Cough, antimicrobial | Perennial; full sun; well-drained soil |
| Garlic | Antimicrobial, blood pressure | Annual; plant cloves in fall |
| Echinacea | Immune support | Perennial; full sun; slow to establish |
| Elderberry | Antiviral, cold/flu | Shrub; full sun; needs cross-pollination |

### VI | Practical Mathematics & Conversions

#### 6.1 Arithmetic Charts and Tables
**Multiplication table (1–12)**

| × | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **1** | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
| **2** | 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 | 22 | 24 |
| **3** | 3 | 6 | 9 | 12 | 15 | 18 | 21 | 24 | 27 | 30 | 33 | 36 |
| **4** | 4 | 8 | 12 | 16 | 20 | 24 | 28 | 32 | 36 | 40 | 44 | 48 |
| **5** | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55 | 60 |
| **6** | 6 | 12 | 18 | 24 | 30 | 36 | 42 | 48 | 54 | 60 | 66 | 72 |
| **7** | 7 | 14 | 21 | 28 | 35 | 42 | 49 | 56 | 63 | 70 | 77 | 84 |
| **8** | 8 | 16 | 24 | 32 | 40 | 48 | 56 | 64 | 72 | 80 | 88 | 96 |
| **9** | 9 | 18 | 27 | 36 | 45 | 54 | 63 | 72 | 81 | 90 | 99 | 108 |
| **10** | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 | 110 | 120 |
| **11** | 11 | 22 | 33 | 44 | 55 | 66 | 77 | 88 | 99 | 110 | 121 | 132 |
| **12** | 12 | 24 | 36 | 48 | 60 | 72 | 84 | 96 | 108 | 120 | 132 | 144 |

**Fraction–decimal–percent equivalents**

| Fraction | Decimal | Percent |
|---|---|---|
| 1/2 | 0.5 | 50% |
| 1/3 | 0.333... | 33.3% |
| 2/3 | 0.666... | 66.7% |
| 1/4 | 0.25 | 25% |
| 3/4 | 0.75 | 75% |
| 1/5 | 0.2 | 20% |
| 1/8 | 0.125 | 12.5% |
| 3/8 | 0.375 | 37.5% |
| 5/8 | 0.625 | 62.5% |
| 7/8 | 0.875 | 87.5% |
| 1/10 | 0.1 | 10% |
| 1/16 | 0.0625 | 6.25% |

**Geometric formulas**

| Shape | Area | Perimeter / Circumference | Volume |
|---|---|---|---|
| **Rectangle** | A = l × w | P = 2(l + w) | — |
| **Triangle** | A = ½ × b × h | P = a + b + c | — |
| **Circle** | A = π × r² | C = 2 × π × r | — |
| **Cylinder** | Side area = 2 × π × r × h | — | V = π × r² × h |
| **Sphere** | A = 4 × π × r² | — | V = (4/3) × π × r³ |
| **Cone** | Side area = π × r × l | — | V = (1/3) × π × r² × h |
| **Rectangular solid** | A = 2(lw + lh + wh) | — | V = l × w × h |

**Mass, volume, density**
Density = Mass ÷ Volume (in symbols, ρ = m ÷ V).
**Water:** density = 1 g/cm³ = 1 kg/L = 62.4 lb/ft³.
Mass = Density × Volume.
Volume = Mass ÷ Density.

**The Rule of 72 (compound interest/growth)**
To estimate how long an exponentially growing quantity takes to double: t ≈ 72 ÷ r, where r is the growth rate in percent per period. Useful for estimating firewood consumption growth, population, or battery discharge.

#### 6.2 Metric / Imperial Conversion Chart

| Quantity | Metric | Imperial/US | Conversion |
|---|---|---|---|
| **Length** | 1 cm | 0.394 in | in × 2.54 = cm |
| | 1 m | 3.281 ft | ft × 0.3048 = m |
| | 1 km | 0.621 mi | mi × 1.609 = km |
| | 1 in | 2.54 cm | cm × 0.394 = in |
| | 1 ft | 30.48 cm | cm × 0.0328 = ft |
| | 1 yd | 0.914 m | m × 1.094 = yd |
| **Weight/Mass** | 1 g | 0.0353 oz | oz × 28.35 = g |
| | 1 kg | 2.205 lb | lb × 0.4536 = kg |
| | 1 oz | 28.35 g | g × 0.0353 = oz |
| | 1 lb | 0.4536 kg | kg × 2.205 = lb |
| **Volume** | 1 mL | 0.0338 fl oz | fl oz × 29.57 = mL |
| | 1 L | 1.057 qt | qt × 0.946 = L |
| | 1 L | 0.264 gal | gal × 3.785 = L |
| | 1 tsp | 4.93 mL | mL × 0.203 = tsp |
| | 1 tbsp | 14.79 mL | mL × 0.0676 = tbsp |
| | 1 cup | 236.6 mL | mL × 0.00423 = cup |
| **Temperature** | °C | °F | F = (9/5) × C + 32 |
| | °F | °C | C = (5/9) × (F − 32) |
| **Energy** | 1 kJ | 0.239 kcal | kcal × 4.184 = kJ |
| | 1 kWh | 3,412 BTU | BTU × 0.000293 = kWh |

**Handy approximations:**
- A meter is about a yard (slightly longer).
- A liter is about a quart (slightly more).
- A kilogram is about 2.2 pounds.
- A kilometer is about 0.6 miles.
- A 100W panel produces about 0.5 kWh on a good day.

#### 6.3 Graph Equations (Linear and Exponential)
**Linear:** y = m × x + b, where m is slope and b is y-intercept. Useful for estimating fuel consumption, water use, or battery discharge at a constant rate.

**Exponential growth/decay:** y = a × e^(k × t) or y = a × (1 + r)^t. Useful for population growth, compound interest, and radioactive decay. **Half-life:** t½ = ln(2) ÷ k.

**Plotting by hand:** Label axes, choose a scale that uses most of the paper, plot points, and draw a smooth line or curve of best fit. A graph is a tool for seeing trends that are invisible in a table.

### VII | Automotive Troubleshooting

#### 7.1 Basic Operation of a Gasoline Engine
A gasoline engine converts chemical energy (fuel) into mechanical energy through **four strokes:**
1. **Intake:** The piston moves down, the intake valve opens, and a mixture of air and fuel is drawn into the cylinder.
2. **Compression:** The piston moves up, both valves close, and the mixture is compressed.
3. **Power:** The spark plug fires, igniting the compressed mixture. The explosion forces the piston down.
4. **Exhaust:** The exhaust valve opens and the piston moves up, pushing burned gases out.

**The supporting systems:**
- **Fuel system:** tank, pump, filter, injectors (or carburetor), pressure regulator.
- **Ignition system:** battery, coil, distributor (or coil-on-plug), spark plugs, crankshaft/camshaft position sensors.
- **Air system:** air filter, throttle body, mass airflow sensor, idle air control.
- **Cooling system:** radiator, water pump, thermostat, coolant hoses.
- **Lubrication system:** oil pump, oil filter, oil galleries.
- **Electrical system:** battery, alternator, starter, fuses, relays, wiring.

#### 7.2 Common Issues, Causes, and Repair Logic

| Symptom | Likely causes (in order of probability) | Simple checks |
|---|---|---|
| **Cranks but won't start** | No spark; no fuel; no compression | Check for spark at a plug (ground it against the block while cranking—**use insulated pliers**). Listen for the fuel pump prime. Check the fuel filter. |
| **Starts then dies** | Fuel pump failing; clogged filter; bad idle air control; vacuum leak | Check fuel pressure at the rail. Inspect vacuum hoses for cracks. Clean the throttle body and IAC. |
| **Rough idle / misfire** | Worn spark plugs; faulty coil; dirty injectors; vacuum leak; low compression | Replace plugs. Swap coils to see if the misfire moves. Check compression (see below). |
| **Overheating** | Low coolant; failed thermostat; bad water pump; clogged radiator; head gasket | **Do not open the radiator cap while hot.** Check coolant level when cold. Feel the upper radiator hose; if it is cold while the engine is hot, the thermostat is stuck closed. |
| **Battery dies / no crank** | Dead battery; bad alternator; parasitic draw; corroded terminals | Clean terminals. Jump-start; if the engine dies immediately after removing the jump, the alternator is suspect. Measure battery voltage: 12.6V resting, 13.5–14.5V running. |
| **Check Engine Light** | Any sensor or emissions fault | A cheap OBD-II scanner (if power is available) reads the code. Without a scanner, inspect the most common culprits: oxygen sensor, mass airflow sensor, gas cap (loose cap triggers EVAP code). |
| **Fuel smell** | Leaking fuel line; bad injector O-ring; EVAP system leak | **Fire risk.** Do not drive. Inspect lines and connections. |
| **Knocking/pinging** | Wrong fuel octane; carbon buildup; bad knock sensor | Use higher-octane fuel if available. Sea Foam or similar additive can remove carbon. |
| **No oil pressure** | Low oil; bad oil pump; clogged pickup; worn bearings | **Stop the engine immediately.** Check oil level. If full, the pump or bearings are suspect. |

**Compression test:** Remove all spark plugs. Screw a compression gauge into one cylinder. Crank the engine 4–6 strokes with the throttle wide open. Record the reading. Repeat for all cylinders. **Normal:** 120–180 psi, with no more than 10% variation between cylinders. **Low compression on two adjacent cylinders** suggests a head gasket leak.

#### 7.3 Spare Parts to Stockpile
For a gasoline vehicle likely to be used in a survival scenario, prioritize:
- **Ignition:** spark plugs, ignition coils, spark plug wires (if applicable), crankshaft position sensor.
- **Fuel:** fuel filter, fuel pump (if accessible), injector O-rings.
- **Cooling:** thermostat, radiator hoses, coolant, water pump (if accessible).
- **Belts and hoses:** serpentine belt, vacuum hoses, heater hoses.
- **Electrical:** fuses (assorted), relays, battery terminals, wire, electrical tape.
- **Fluids:** engine oil, transmission fluid, brake fluid, power steering fluid, coolant.
- **Filters:** oil filter, air filter, cabin air filter.
- **Tools:** socket set, wrench set, screwdrivers, pliers, jack, jack stands, tire plug kit, jumper cables, multimeter.

**The most common failure points on older vehicles:** vacuum leaks (cracked rubber hoses), corroded electrical grounds, dirty throttle bodies, and worn spark plugs. These are cheap to fix and prevent the majority of breakdowns.

### VIII | Survival Spanish Phrasebook

#### 8.1 Greetings and Basic Conversation
**Pronunciation guide:** Spanish vowels are pure: a = "ah," e = "eh," i = "ee," o = "oh," u = "oo." The letter "h" is silent. "J" sounds like "h" (Juan = "Hwahn"). "LL" sounds like "y" (llave = "yah-veh"). "Ñ" sounds like "ny" (año = "ah-nyo"). Stress usually falls on the second-to-last syllable unless an accent mark indicates otherwise.

| English | Spanish | Pronunciation |
|---|---|---|
| Hello | Hola | OH-lah |
| Good morning | Buenos días | BWEH-nohs DEE-ahs |
| Good afternoon | Buenas tardes | BWEH-nahs TAR-dehs |
| Good evening/night | Buenas noches | BWEH-nahs NOH-chehs |
| How are you? (formal) | ¿Cómo está usted? | KOH-moh eh-STAH oos-TEHD |
| How are you? (informal) | ¿Cómo estás? | KOH-moh eh-STAHs |
| I'm fine, thank you | Bien, gracias | BYEHN, GRAH-syahs |
| What is your name? | ¿Cómo se llama? | KOH-moh seh YAH-mah |
| My name is… | Me llamo… | meh YAH-moh |
| Nice to meet you | Mucho gusto | MOO-choh GOOS-toh |
| Please | Por favor | por fah-VOR |
| Thank you | Gracias | GRAH-syahs |
| You're welcome | De nada | deh NAH-dah |
| Excuse me / Sorry | Disculpe / Perdón | dees-KOOL-peh / per-DOHN |
| Yes / No | Sí / No | see / noh |
| I don't understand | No entiendo | noh ehn-TYEHN-doh |
| Do you speak English? | ¿Habla inglés? | AH-blah een-GLEHS |
| I don't speak Spanish | No hablo español | noh AH-bloh ehs-pah-NYOL |
| Goodbye | Adiós | ah-DYOHS |
| See you later | Hasta luego | AH-stah LWEH-goh |

#### 8.2 Survival and Emergency Phrases

| English | Spanish |
|---|---|
| I need help | Necesito ayuda |
| Help! | ¡Ayuda! |
| Call a doctor | Llame a un médico |
| I am hurt | Estoy herido |
| I am lost | Estoy perdido |
| Where is the hospital? | ¿Dónde está el hospital? |
| Where is the police? | ¿Dónde está la policía? |
| I need water | Necesito agua |
| I need food | Necesito comida |
| I am hungry | Tengo hambre |
| I am thirsty | Tengo sed |
| Is it safe? | ¿Es seguro? |
| Danger | Peligro |
| Go away | Váyase |
| I have a weapon | Tengo un arma |
| I don't want trouble | No quiero problemas |
| How much does it cost? | ¿Cuánto cuesta? |
| Too expensive | Demasiado caro |
| Where is the market? | ¿Dónde está el mercado? |
| Can I sleep here? | ¿Puedo dormir aquí? |
| I need shelter | Necesito refugio |
| Fire | Fuego |
| Flood | Inundación |
| Earthquake | Terremoto |
| Storm | Tormenta |

#### 8.3 Directions and Travel

| English | Spanish |
|---|---|
| Where is…? | ¿Dónde está…? |
| North / South / East / West | Norte / Sur / Este / Oeste |
| Left / Right | Izquierda / Derecha |
| Straight ahead | Todo recto |
| Far / Near | Lejos / Cerca |
| Road / Path | Camino / Sendero |
| River | Río |
| Mountain | Montaña |
| Village / Town | Pueblo / Ciudad |
| How far? | ¿Qué tan lejos? |
| How many hours? | ¿Cuántas horas? |

#### 8.4 Numbers and Time

| Number | Spanish | Number | Spanish |
|---|---|---|---|
| 1 | uno | 20 | veinte |
| 2 | dos | 30 | treinta |
| 3 | tres | 40 | cuarenta |
| 4 | cuatro | 50 | cincuenta |
| 5 | cinco | 60 | sesenta |
| 6 | seis | 70 | setenta |
| 7 | siete | 80 | ochenta |
| 8 | ocho | 90 | noventa |
| 9 | nueve | 100 | cien |
| 10 | diez | 1,000 | mil |

**Time:** ¿Qué hora es? (What time is it?) — Son las dos (It's 2 o'clock). La mañana (morning); la tarde (afternoon); la noche (night). Hoy (today); mañana (tomorrow); ayer (yesterday).

#### 8.5 Food and Water

| English | Spanish |
|---|---|
| Water | Agua |
| Food | Comida |
| Bread | Pan |
| Meat | Carne |
| Rice | Arroz |
| Beans | Frijoles |
| Fruit | Fruta |
| Vegetables | Verduras |
| Milk | Leche |
| Salt | Sal |
| Sugar | Azúcar |
| I am allergic to… | Soy alérgico a… |
| Is this clean? | ¿Esto está limpio? |
| Boiled water | Agua hervida |

### Notes | Final Notes

#### Making the Document
This encyclopedia is deliberately **modular.** Print it, bind it, and add your own notes. The margins are for your observations: local plant identification, frost dates, well depth, radio frequencies, and the names of neighbors who share skills.

**The most important page is the one you write yourself.** Practice one skill at a time. Teach it to someone else; teaching is the deepest form of learning. When the systems fail, the people who thrive are not the ones with the most gear—they are the ones with the most **practiced competence** and the strongest **community.**

**A note on safety:** Every technique here carries risk. Fire, electricity, sharp tools, and medicine can all harm you. **Start small, use protective equipment, and never work alone when tired or rushed.** The goal is not to be a hero; the goal is to be alive and useful tomorrow.

**Sources and further study:** This edition draws on the original *Survivor's Encyclopedia* and integrates practical guidance from *Mother Earth News* on food preservation, evidence-based herbal medicine summaries, emergency navigation standards, automotive ignition troubleshooting, and traditional passive climate-control knowledge. For deeper study, the works of Adam Danforth (butchering), David Burch (*Emergency Navigation*), and Eben Fodor (*The Solar Food Dryer*) are recommended.

**Save this document. Print it. Practice it.**
