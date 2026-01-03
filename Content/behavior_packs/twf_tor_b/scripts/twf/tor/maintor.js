//  The World Foundry


const NAMESPACE = "twf_tor:"
const GUIDE_BOOK_NAME = "THE ONE RING Guide"
const NOTIFY_KEY = NAMESPACE+"notify"
const MSG_PREFIX = "[THE ONE RING]"

/* @TheWorldFoundry

	BEDROCK ADD-ON DEVELOPMENT (BAD) Framework
*/
const NS = NAMESPACE

import * as mc from "@minecraft/server";
import * as mcui from "@minecraft/server-ui";

const gvfo = get_value_from_obj;
const C = constant;
const P = dynpropkey;

let DEBUG = false; // CHANGE ME

/*  ===========================================
	Handle running the product
*/

let iteration = 0;
let dimensions = undefined;	// Global scope

mc.system.runInterval(() => {
   try {
       run_each_frame(C("TTL"));
   } catch(error) {
       if(DEBUG) mc.world.sendMessage("["+NS+"] Error in mc.system.runInterval: "+String(error)+" "+String(error.stack));
   }
}, 1);

function each_handler(ttl, run_start_ts, context_name, subject) {
	const tick_defs = gvfo(PRODUCT, [context_name]);

	for(let tick_def of tick_defs) {
		for(const [key, value] of Object.entries(tick_def)) {
			const ticks = gvfo(value, ["ticks"]);
			
			if(iteration % ticks == 0) {	// Only run repeating actions on their proscribed schedule
				const action = gvfo(value, ["action"]);
				
				if(action) {
					try {
						
						action(subject, value);
					} catch(error) {
						if(DEBUG) mc.world.sendMessage("["+NS+"] Error in run_each_frame handler action: "+String(error)+" "+String(error.stack));
					}
				}
			}
		}
		if(new Date().getTime() - run_start_ts > ttl) return; // Exit if exceeded budget	
	}		
}

let players_processed = new Map(); // Global scope
function run_each_player(ttl, run_start_ts) {
	// Look at the product and do whatever is required
	let players_processed_flag = false;
	let iters = undefined;
	const players = mc.world.getPlayers();
	for ( let player of players ) {
		if(!players_processed.get(player.name)) {
			each_handler(ttl, run_start_ts, "each_player", player);
			
			iters = get_dynamic_property_with_default(player, C("PROP_PLAYER_ITERATIONS"), 0);
			if(!iters) iters = 0;
			iters++;
			player.setDynamicProperty(C("PROP_PLAYER_ITERATIONS"), iters);
			players_processed.set(player.name, player);					
			players_processed_flag = true;
		}
	}
	if(players.length > 0 && !players_processed_flag) {	// Nobody was pending
		players_processed.clear(); // = new Map();	// Purge all old tracked players.
		run_each_player(ttl, run_start_ts); // retry
	}
}

function run_each_dimension(ttl, run_start_ts) {
	// Look at the product and do whatever is required
	for(let dimension of dimensions) {
		each_handler(ttl, run_start_ts, "each_dimension", dimension);
	}
}

function run_each_frame(ttl) {
	const run_start_ts = new Date().getTime();
	iteration++;
	
	if(!dimensions) {	// initialisation
		dimensions = [ mc.world.getDimension("overworld"), mc.world.getDimension("nether"), mc.world.getDimension("the_end") ];
	}
	
	const tick_defs = gvfo(PRODUCT, ["on_tick"]);
	for(let tick_def of tick_defs) {
		const ticks = gvfo(tick_def, ["ticks"]);
		if(iteration % ticks == 0) {	// Only run repeating actions on their proscribed schedule
			const action = gvfo(tick_def, ["action"]);
			if(action) {
				try {
					action();
				} catch(error) {
					if(DEBUG) mc.world.sendMessage("["+NS+"] Error in run_each_frame action: "+String(error)+" "+String(error.stack));
				}
			}
		}
		if(new Date().getTime() - run_start_ts > ttl) return; // Exit if exceeded budget
	}
	
	// Run any time-scheduled tasks. You add these future-running tasks in your functions.
	while(temporal_extruder.peek()?.targetTick <= mc.system.currentTick) { // Yes there is work due or past
		const next_task = temporal_extruder.pop();
		try {
			next_task.callback(next_task, ttl, run_start_ts, PRODUCT);
		} catch(error) {
			if(DEBUG) mc.world.sendMessage("["+NS+"] Error in run_each_frame action: "+String(error)+" "+String(error.stack));
		}
		
		if(new Date().getTime() - run_start_ts > ttl) return; // Exit if exceeded budget
	}
}


/*  ===========================================
	Generic handlers for ad-hoc events
*/

// This TWF Framework entry points

// START NOTIFY GUIDE BOOK

function guide_book_show(player) {
	const PAGE_NAME = "guide.start";
	let this_form = new_action_form(PAGE_NAME);
	let notify_button = NS+PAGE_NAME+".settings_button";
	if( !player.getDynamicProperty(gvfo(PRODUCT, ["notifications","key"])) ) {
		notify_button += ".disabled"
	}
	
	this_form.button({rawtext: [{translate: notify_button,with: ["\n"]}]}); // Button 0
	this_form.button({rawtext: [{translate: NS+PAGE_NAME+".button",with: ["\n"]}]}); // Button 1
	this_form.show(player).then((response) => {
		if(response === undefined || response.cancelled) {
			return; // do nothing? Drop out of the forms entirely?
		}
		if(response.selection == 0) {
			guide_book_notify_on_off_show(player, guide_book_show);
		}
	});
};

function guide_book_notify_on_off_show(player, callback) {
	const PAGE_NAME = "guide.notify_on_off";
	let this_form = new_action_form(PAGE_NAME);
	this_form.button({rawtext: [{translate: NS+PAGE_NAME+".notify_on",with: ["\n"]}]}); // Button 0
	this_form.button({rawtext: [{translate: NS+PAGE_NAME+".notify_off",with: ["\n"]}]}); // Button 1
	this_form.button({rawtext: [{translate: NS+PAGE_NAME+".notify_log",with: ["\n"]}]}); // Button 2
	this_form.button({rawtext: [{translate: NS+PAGE_NAME+".cancel",with: ["\n"]}]}); // Button 3
	this_form.show(player).then((response) => {
		if(response === undefined || response.cancelled) {
			return; // do nothing? Drop out of the forms entirely?
		}
		if(response.selection == 0) {
			player.setDynamicProperty(gvfo(PRODUCT, ["notifications","key"]), true);
			guide_book_notify_settings_show(player, guide_book_show);
		}
		if(response.selection == 1) {
			player.setDynamicProperty(gvfo(PRODUCT, ["notifications","key"]), false);
			callback(player);
		}
		if(response.selection == 2) {
			guide_book_notify_log_show(player, callback);
		}
		if(response.selection == 3) {
			callback(player);
		}
		
	});	
}

function guide_book_notify_log_show(player, callback) {
	const PAGE_NAME = "guide.notify_log";
	let this_form = new_action_form(PAGE_NAME);
	
	let body = "§bPAST NOTIFICATIONS:§r\n\n";
	if( notify_log[player.id] != undefined ) {
		
		for(let i = 0; i < 	notify_log[player.id].length; i++) {
			
			body += String(i+1)+": "
			if(notify_log[player.id][i].length > 1) {
				body += notify_log[player.id][i][0]+"\n    "
				body += notify_log[player.id][i][1]+"\n\n"
				
			} else {
				body += notify_log[player.id][i][0]+"\n"
			}
		}
	} else {
		body += "None.\n\n";
	}

	this_form.body(body);
	
	this_form.button({rawtext: [{translate: NS+PAGE_NAME+".button",with: ["\n"]}]}); // Button 1
	this_form.show(player).then((response) => {
		if(response === undefined || response.cancelled) {
			return; // do nothing? Drop out of the forms entirely?
		}
		if(response.selection == 0) {
			guide_book_notify_on_off_show(player, callback);
		}
	});
}

function guide_book_notify_settings_show(player, callback) {
	/*
		Handles notify settings
	*/
	const notifications = [
		gdpwd(player, gvfo(PRODUCT, ["notifications","key_msg"]), true),
		gdpwd(player, gvfo(PRODUCT, ["notifications","key_title"]), true),
		gdpwd(player, gvfo(PRODUCT, ["notifications","key_particle"]), true),
		gdpwd(player, gvfo(PRODUCT, ["notifications","key_sound"]), true)
	]
	for(let i = 0; i < notifications.length; i++) {
		if(notifications[i] == undefined) {
			notifications[i] = true;
		}
		notifications[i] = { defaultValue: notifications[i] }
	}
	
	const PAGE_NAME = "guide.settings";
	let this_form = new mcui.ModalFormData().title({rawtext: [{translate: NS+PAGE_NAME+".title",with: ["\n"]}]});
	this_form.toggle({rawtext: [{translate: NS+PAGE_NAME+".messages",with: ["\n"]}]}, notifications[0] ); // Messages on/off
	this_form.toggle({rawtext: [{translate: NS+PAGE_NAME+".titles",with: ["\n"]}]}, notifications[1] ); // Titles on/off
	this_form.toggle({rawtext: [{translate: NS+PAGE_NAME+".particles",with: ["\n"]}]}, notifications[2] ); // Particles on/off
	this_form.toggle({rawtext: [{translate: NS+PAGE_NAME+".sounds",with: ["\n"]}]}, notifications[3] ); // Sounds on/off
	this_form.show(player).then((response) => {
		if(response === undefined || response.cancelled) {
			return; // do nothing? Drop out of the forms entirely?
		}
		if(response && response.formValues) {
			if(response.formValues.length >= 1) {
				player.setDynamicProperty(gvfo(PRODUCT, ["notifications","key_msg"]), response.formValues[0]);
				player.setDynamicProperty(gvfo(PRODUCT, ["notifications","key_title"]), response.formValues[1]);
				player.setDynamicProperty(gvfo(PRODUCT, ["notifications","key_particle"]), response.formValues[2]);
				player.setDynamicProperty(gvfo(PRODUCT, ["notifications","key_sound"]), response.formValues[3]);
			}
		}
		callback(player);
	});
};

const notify_log = new Map(); // Per-session per-player rolling log of notifications
function notify(player, context, location) {
	// log any message first
	if(notify_log[player.id] == undefined) {
		notify_log[player.id] = new Array();
	}
	if(gdpwd(player, gvfo(PRODUCT, ["notifications","log"]), true)) {
		const msg = gvfo(context, ["notify", "msg"]);
		const desc = gvfo(context, ["notify", "description"]);
		if(msg && desc) {
			notify_log[player.id].push([msg, desc])
		} else if(msg) {
			notify_log[player.id].push([msg])
		}
		const log_limit = gdpwd(player, gvfo(PRODUCT, ["notifications","log_limit"]), C("NOTIFY_LOG_LIMIT"));
		if(log_limit > 0) {
			while( notify_log[player.id].size > log_limit ) {
				notify_log[player.id].shift(); // Remove the oldest entries
			}
		}
	}
	
	// Conditional display next
	let notify = gdpwd(player, gvfo(PRODUCT, ["notifications","key"]), true);
	if(notify) {
		const msg = gvfo(context, ["notify", "msg"]);
		let desc = gvfo(context, ["notify", "description"]);
		
		if(msg) {
			if(desc === undefined) desc = "";

			if(gdpwd(player, gvfo(PRODUCT, ["notifications","key_msg"]), true) ) {
				player.sendMessage(gvfo(PRODUCT, ["notifications","prefix"])+" "+text_flair(msg)+" "+desc);
			}
			if( gdpwd(player, gvfo(PRODUCT, ["notifications","key_title"]), true) ) {
				player.onScreenDisplay.setTitle(text_flair(msg), {
					stayDuration: gvfo(context, ["notify", "duration"]),
					fadeInDuration: 2,
					fadeOutDuration: 4,
					subtitle: text_flair(desc)
				});
			}
		}
		
		if( gdpwd(player, gvfo(PRODUCT, ["notifications","key_particle"]), true) ) {
			const particles = gvfo(context, ["notify", "particles"]);
			if(particles) {
				play_particle(player, particles);
			}
		}		
		
		if( gdpwd(player, gvfo(PRODUCT, ["notifications","key_sound"]), true) ) {
			const sounds = gvfo(context, ["notify", "sounds"]);
			if(sounds) {
				play_sound(player, sounds);
			}
		}
		
		const entities = gvfo(context, ["notify", "entities"]);
		if(entities) {
			spawn_entities(player, entities, location, context);
		}
		
		const items = gvfo(context, ["notify", "items"]);
		if(items) {
			give_items_to_player(player, items);
		}		
	}
}

// END NOTIFY GUIDE BOOK

function player_item_scan(player, context) {
	// Tag the player if an item is found that satisfies the rules
	const IN_INVENTORY = "Inventory";
	const items = gvfo(context, ["items"]);

	if(items.length == 0) return; // Nothing to Do

	const jobs = []
	// Peek at the instructions to see if we need to look at the inventory. If yes, pre-load it.
	let inv_load = false;
	for(let item of items) {	// Check each of the item rule records
		if(iteration%gvfo(item, ["ticks"]) == 0) {
			jobs.push( item )	// Ready to run list
			const locs = gvfo(item, ["where"]);
			for(let loc of locs) {
				if( loc == IN_INVENTORY ) {
					inv_load = true;
				}
			}
		}
	}
		
	let inv = undefined;
	if(inv_load) {	// we need to scan the inventory for items, so do it once only.
		inv = convert_inventory_to_map(player);
	}
	
	for(let item of jobs) {	// Check each of the item rule records
		const what = gvfo(item, ["what"]);
		const locs = gvfo(item, ["where"]);
		let action = gvfo(item, ["action"]);
		
		let found = false;
		
		for(let where of locs) {
			if(where == IN_INVENTORY) { // Only care if the player has the item
				// I can check inv, if present.
				if(inv) {
					if(inv.get(what) != undefined) {
						found = true;
						break;
					}
				}
			} else {	// Must be an equipment slot reference
				if(whats_in_equipment_slot(player, where)?.typeId == what) {
					found = true;
					break;
				}
			}
		}
		
		if(found) {
			// tag the player
			player.addTag(what);
			
			run_action_player(player, item, action)
		} else {
			player.removeTag(what);
		}
	}
}

function spawn_entities(player, entities, location, context) {
	for(let entity_def of entities) {
		let what = gvfo(entity_def, ["what"]);
		
		if(what) {
			let ntt = undefined;		
			if(location) {
				ntt = spawn_entity(what, player.dimension, location);
			} else {	// 
				ntt = spawn_entity(what, player.dimension, player.location);
			}
			if(ntt) {	// Handle flairs
				
				let sounds = gvfo(entity_def, ["notify", "sounds"]);
				if(sounds) {
					play_sound(ntt, sounds);
				}
				let particles = gvfo(entity_def, ["notify", "particles"]);
				if(particles) {
					play_particle(ntt, particles);
				}
			}				
		}
	}
}

function spawn_entities_in_dimension(dimension, entities, location, context) {
	for(let entity_def of entities) {
		let what = gvfo(entity_def, ["what"]);
		
		if(what) {
			let ntt = undefined;		
			ntt = spawn_entity(what, dimension, location);
			if(ntt) {	// Handle flairs
				
				let sounds = gvfo(entity_def, ["notify", "sounds"]);
				if(sounds) {
					play_sound(ntt, sounds);
				}
				let particles = gvfo(entity_def, ["notify", "particles"]);
				if(particles) {
					play_particle(ntt, particles);
				}
			}				
		}
	}
}

function spawn_entity(entity, dimension, location) {
	try {
		return dimension.spawnEntity( entity, location );
	} catch(error) {
		if(DEBUG) mc.world.sendMessage(String(error));
	}
}

function run_action_player(subject, context, action) {
	if(subject) {
		if(typeof action === 'string') {				
			let handler = gvfo(PRODUCT, [action, "handler"]);
			if(handler) handler(subject, gvfo(PRODUCT, [action]));
		} else {
			action(subject, context);
		}
	}	
}

function run_action_event(event, context) {
	const action = gvfo(context, ["action"]);
	if(action) action(event, context);
}

// Minecraft framework event entry points

mc.world.afterEvents.itemUse.subscribe(async (event) => {
		const { source: player, itemStack } = event;
		
		// Check if there's a definition we can use
		const items = gvfo(PRODUCT, ["on_player_use_item"]);
		for(let item of items) {
			if(itemStack?.typeId.includes( gvfo(item, ["what"]))) {
				if(itemStack?.nameTag === gvfo(item, ["name"])) {
					run_action_player(player, item, gvfo(item, ["action"]));
				}
			}
		}
	});

mc.world.afterEvents.playerSpawn.subscribe(event => {
		const key = gvfo(PRODUCT, ["on_spawn_player", "tag_player", "key"]);

		if(key) {
			if(!event.player.getDynamicProperty(key)) {	// Not yet set
				run_action_player(event.player, gvfo(PRODUCT, ["on_spawn_player"]), gvfo(PRODUCT, ["on_spawn_player", "action"]));
				event.player.setDynamicProperty(key, gvfo(PRODUCT, ["on_spawn_player", "tag_player", "val"]));
			}
		}
	});

mc.world.afterEvents.entityHurt.subscribe((event) => {
		const { damageSource, hurtEntity } = event;
		if (damageSource && hurtEntity) {
			// Check if there's a definition we can use
			const hurt_defs = gvfo(PRODUCT, ["on_hurt_entity"]);
			for(let hurt_def of hurt_defs) {
				if( damageSource?.damagingEntity?.typeId.includes( gvfo(hurt_def, ["what"]))) {
					run_action_event(event, hurt_def);
				}
			}
		}
	});

mc.system.afterEvents.scriptEventReceive.subscribe((event) => {
		const events = gvfo(PRODUCT, ["on_script_event_receive"]);
		for(let evt of events) {
			run_action_event(event, evt);
		}
	});

mc.world.beforeEvents.playerBreakBlock.subscribe((event) => {
		const events = gvfo(PRODUCT, ["on_player_break_block"]);
		for(let evt of events) {
			run_action_event(event, evt);
		}
	});


/*  ===========================================
	Actions - generic framework functions
*/

function give_items(player, context) {
	// Give any items
	let items = gvfo(context, ["items"]);
	give_items_to_player(player, items);
	notify( player, context, undefined);				
}


/*  ===========================================
	Cosmetics - generic framework functions
*/

function play_sound(subject, sounds) {
	for(let sound_def of sounds) {
		let what = gvfo(sound_def, ["what"]);
		let who = gvfo(sound_def, ["who"]);
		let volume = gvfo(sound_def, ["volume"]);
		let pitch = gvfo(sound_def, ["pitch"]);

		who = "@s";
		if(pitch == "random") {
			pitch = String(	Math.round((1.1+Math.random()*0.8)*100)/100	); // 2 decimal places
		}
		let snd = C(what); // Have we been passed a list of sounds to pick one from?
		if(snd) {
			what = snd[Math.floor(Math.random()*snd.length)];
		}

		const command = "/playsound "+what+" "+who+" ~ ~ ~ "+volume+" "+pitch;
		subject.runCommand(command);
	};
}

function play_particle(entity, particles) {
	for(let particle_def of particles) {
		let what = gvfo(particle_def, ["what"]);
		let where = entity.location;

		entity.dimension.runCommand("/particle "+what+" "+String(Math.floor(where.x))+" "+String(Math.floor(where.y+1.5))+" "+String(Math.floor(where.z)));	
	}
}

function entity_apply_effects(subject, context) {
	const effects = gvfo(context, ["effects"]);
	for(let effect of effects) {
		const what = gvfo(effect, ["what"]);
		const when = gvfo(effect, ["when"]);
		const options = gvfo(effect, ["options"]);
		subject.addEffect(what, when, options);
	}
};

/*  ==========================================
	Transform the game state - generic framework functions
*/
function give_items_to_player(player, items) {
	for(let item_def of items) {
		let item_id = gvfo(item_def, ["what"]);
		let item_qty = gvfo(item_def, ["amount"]);
		let item_name = gvfo(item_def, ["name"]);
		
		if(!item_qty) item_qty = 1;
		let item = new mc.ItemStack(item_id, item_qty);
		if(item_name) item.nameTag = item_name;
		player.dimension.spawnItem(item, player.location);
	}
}


/*	==========================================
	Utilities - transforming variables, etc. - generic framework functions
*/

function new_action_form(identifier) {
	let this_form = new mcui.ActionFormData();
	this_form.title({rawtext: [{translate: NS+identifier+".title",with: ["\n"]}]});
	this_form.body({rawtext: [{translate: NS+identifier+".body",with: ["\n"]}]});
    // this_form.button({rawtext: [{translate: NS+identifier+".button",with: ["\n"]}]}) // Button 0
	
	return this_form;
}

function dynpropkey(name) {
	const v = C("DYNPROPKEYS");
	if(name in v) return name;
}

function constant(name) { 
	return gvfo(PRODUCT, ["constants", name]); 
}

function get_value_from_obj(obj, keys) {
	// Takes a list of strings defining a path in an object
	// Returns undefined if any of the keys are undefined
	// Returns the value otherwise
	try {
		let context = obj
		for(let o of keys) {
			// if(DEBUG) mc.world.sendMessage("Context: "+String(o));
			context = context[o];
			// if(DEBUG) mc.world.sendMessage("Context: "+JSON.stringify(context));
		}
		return context;
	} catch(error) {}
	return undefined;
}

function get_dynamic_property_with_default(player, key, def_val) {
	let prop = player.getDynamicProperty(key);
	if(prop == undefined) {
		prop = def_val;
		player.setDynamicProperty(key, prop);
	}
	return prop
}
const gdpwd = get_dynamic_property_with_default;

function incrementDynamicPropertyWithInitialise(player, key) {
	let prop = player.getDynamicProperty(key);
	if(!prop) prop = 0;
	prop++;
	player.setDynamicProperty(key, prop);
	return prop;
}

function text_flair(msg) {
	if(msg) {
		if(msg[0] != '§') {
			const cols = ["§c","§6","§e","§a","§b","§a","§e","§6","§c"] // ,"§r"
			// Add some interest to the msg with colour
			let result = ""
			let idx = Math.floor(Math.random()*cols.length)
			for(let c of msg) {
				result += cols[idx%cols.length] + c;
				idx++;
			}
			return result+"§r";
		}
	}
	return msg;
}

function distance_between(p1, p2) {
	let result = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2 + (p2.z - p1.z)**2);
	return result;
};

function now() {
	return mc.system.currentTick;
}

function random_integer(min, max) {
	let val = Math.floor(Math.random()*(max-min));
	return min+val;
}

function roll_dice(dice_size, dice_num) {
	let val = 0
	
	for(let i=0; i < dice_num; i++) {
		val += random_integer(1, dice_size) // 1d6
	}
	return val;
}

function make_location_key(dim, loc) {
	return String(dim)+" "+String(Math.floor(loc.x))+" "+String(Math.floor(loc.y))+" "+String(Math.floor(loc.z));
};

/* INVENTORY START */

function convert_inventory_to_map(player) {
	// Sweep through the inventory, making the 
	const inv_map = new Map();
	const inv = player.getComponent( 'inventory' ).container;
	if(!inv) return undefined;
	let itm = undefined;
	let itm_val = undefined;
	let slots = undefined;
	let qty = undefined;
	for(let slot = 0; slot < inv.size; slot++) {	// Look through the player's inventory
		itm = inv.getItem(slot);	// Container slots may contain things. Get it if present.
		if(itm) {	// Not undefined
			qty = itm.amount;	// The quantity of this item in this slot
			itm_val = inv_map.get(itm.typeId);	// Do we already have a record of this item in the map?

			if(itm_val) { // Item exists in the map
				slots = itm_val[1];	// Record which slot we found this in
				slots.push(slot);
				qty += itm_val[2];	// Adjust the total amount in this inventory
				inv_map.set(itm.typeId, [itm, slots, qty]);	// Replace the current record
			} else {
				inv_map.set(itm.typeId, [itm, [slot], qty]);	// Create a new record
			}
		}
	}
	return inv_map;
}

function find_item_in_player_inventory(player, itemname) {
	let inv = player.getComponent( 'inventory' ).container;
	if(inv) {
		return find_item_in_inventory(inv, itemname);
	};
	return undefined;
};

function find_item_in_inventory(inv, itemname) {
	// for(let slot = inv.size-1; slot >= 0; slot--) {
	for(let slot = 0; slot < inv.size; slot++) {
		let itm = inv.getItem(slot)
		if(itm) {
			if(itm.typeId == itemname) {
				return slot;
			};
		};
	};
	return undefined;
};

function find_item_in_inventory_loose(inv, itemname) {
	// for(let slot = inv.size-1; slot >= 0; slot--) {
	for(let slot = 0; slot < inv.size; slot++) {
		let itm = inv.getItem(slot)
		if(itm) {
			if(itm.typeId.includes(itemname)) {
				return slot;
			};
		};
	};
	return undefined;
};

function deplete_item_search(player, itemname) {
	let inv = player.getComponent( 'inventory' ).container;
	if(inv) {
		let found_slot = find_item_in_inventory(inv, itemname);
		if(found_slot !== undefined) {
			let itm = inv.getItem(found_slot)
			if(itm) {
				const runId = mc.system.runInterval(() => {
					if(itm.amount == 1) inv.setItem(found_slot);
					else {
						let amm = itm.amount;
						inv.setItem(found_slot, new mc.ItemStack(itemname, amm - 1));
					};
					mc.system.clearRun(runId);
				}, 1);
				return true;
			};
		};
	};
	return false;
}

function replace_all_item_search_loose(player, itemname, replacewithitem) {
	let inv = player.getComponent( 'inventory' ).container;
	let replaced = false
	if(inv) {
		for(let slot = 0; slot < inv.size; slot++) {
			let itm = inv.getItem(slot)
			if(itm) {
				if(itm.typeId.includes(itemname)) {
					if(itm.amount > 0) {	// Should always be true
						inv.setItem(slot, new mc.ItemStack(replacewithitem, itm.amount));
						replaced = true
					}
				};
			};
		};		
	};
}

function deplete_item(player, itemname) {
	let inv = player.getComponent( 'inventory' ).container;
	if(inv) {
		let itm = inv.getItem(player.selectedSlotIndex);
		if(itm) {
			if(itm.typeId == itemname) {
				const runId = mc.system.runInterval(() => {
					if(itm.amount == 1) inv.setItem(player.selectedSlotIndex);
					else {
						let amm = itm.amount;
						inv.setItem(player.selectedSlotIndex, new mc.ItemStack(itemname, amm - 1));
					};
					mc.system.clearRun(runId);
				}, 1);
				return true;
			};
		};
	};
	return false;
};

function whats_in_equipment_slot(player, slot_name) {
	const equippable = player.getComponent("equippable");
	
	if (equippable !== undefined) {
		return equippable.getEquipment(slot_name);
	};
	return undefined;
}

/* INVENTORY END */


/* PRIORITY QUEUE */

/**
 * A Min-Heap based Priority Queue for Task objects.
 * Prioritizes objects with the smallest 'targetTick' value.
 *
 * NOTE: All stored objects must have a 'targetTick' property (number).
 */
class PriorityQueue {
    constructor() {
        this.heap = [];
    }

    /**
     * @returns The number of elements in the queue.
     */
    size() {
        return this.heap.length;
    }

    /**
     * Returns the highest-priority element (smallest targetTick) without removing it.
     * O(1) complexity.
     */
    peek() {
        return this.heap.length > 0 ? this.heap[0] : undefined;
    }

    /**
     * Adds a new item to the queue.
     * O(log N) complexity.
     */
    push(item) {
        this.heap.push(item);
        this.bubbleUp(this.heap.length - 1);
    }

    /**
     * Removes and returns the highest-priority element (smallest targetTick).
     * O(log N) complexity.
     */
    pop() {
        if (this.heap.length === 0) {
            return undefined;
        }

        if (this.heap.length === 1) {
            return this.heap.pop();
        }

        // Swap the root (min element) with the last element
        const root = this.heap[0];
        this.heap[0] = this.heap.pop();
        this.bubbleDown(0);

        return root;
    }

    /**
     * Helper to move an element up the heap until heap property is restored.
     */
    bubbleUp(k) {
        let parent = Math.floor((k - 1) / 2);

        while (k > 0 && this.heap[k].targetTick < this.heap[parent].targetTick) {
            // Swap item with its parent using array destructuring
            [this.heap[k], this.heap[parent]] = [this.heap[parent], this.heap[k]];
            k = parent;
            parent = Math.floor((k - 1) / 2);
        }
    }

    /**
     * Helper to move an element down the heap until heap property is restored.
     */
    bubbleDown(k) {
        const length = this.heap.length;

        while (true) {
            let left = 2 * k + 1;
            let right = 2 * k + 2;
            let swapIndex = k;

            // Check left child
            if (left < length && this.heap[left].targetTick < this.heap[swapIndex].targetTick) {
                swapIndex = left;
            }

            // Check right child, prioritizing it if it's smaller than the current smallest
            if (right < length && this.heap[right].targetTick < this.heap[swapIndex].targetTick) {
                swapIndex = right;
            }

            // If the current element is the smallest, we are done
            if (swapIndex === k) {
                break;
            }

            // Perform the swap and continue bubbling down
            [this.heap[k], this.heap[swapIndex]] = [this.heap[swapIndex], this.heap[k]];
            k = swapIndex;
        }
    }
}
const temporal_extruder = new PriorityQueue();

/* PRODUCT DEFINITION GOES HERE */

const PRODUCT = {
	product_name : MSG_PREFIX,
	notify : { // Dummy notify
		msg : MSG_PREFIX + " ADD-ON",
		description : "By @TheWorldFoundry",
		duration : 300,
		particles : [
			{
				what: "minecraft:large_explosion"
			}
		],
		sounds : [
			{
				what: "random.explode",
				who: "player",
				volume: "1.0",
				pitch: "random"
			}
		]
	},

	on_tick : [	// Table of repeating actions to take 
		{
			ticks : 1,
			action : run_each_dimension
		},
		{
			ticks : 1,
			action : run_each_player
		}
	],
	
	
	each_player : [
		{
			player_inventory_scan : {
				action: player_item_scan,
				ticks : 1,
				items : [ // Table of effects to apply when player has item/in equipment slot
					{
						ticks: 20,
						what: "twf_tor:the_one_ring",	// Item
						where: [ "Offhand", "Mainhand" ],	// equipment slot, inventory, or active slot? https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/equipmentslot?view=minecraft-bedrock-stable
						action: entity_apply_effects,
						effects: [
							{
								what: "minecraft:invisibility",	// Get this from vanilla-data TypeScript defs.
								when: 25,
								options: {
									amplifier: 1,
									showParticles: false	// Node: Command line is hide particles
								}
							}
						]
						
					}					
				]
			}
		},
		{
			ring_leaves_player_inventory: {
				action: the_one_ring_hop_away,
				ticks: 30
			}
		},
		{
			weild_causes_damage: {
				action: gold_weilder_damage,
				ticks: 50
			}
		}
		
	],

	each_dimension: [
		{
			convert_proto_encounter : {
				action: convert_proto_encounter,
				ticks: 1
			}
		}
	],

	on_spawn_player : {
		action : give_items,
		items: [ 
			{
				what: "minecraft:book",
				amount: 1,
				name: GUIDE_BOOK_NAME
			}
		],
		tag_player: { key: NS+"spawn_items_given1", val: 1 },
		notify : {
			msg : "New Items!",
			description : "Check your inventory.",
			duration : 200,
			particles : [
				{	
					what: "minecraft:large_explosion"
				},
				{	
					what: "minecraft:large_explosion"
				}					
			],
			sounds : [
				{
					what: "random.explode",
					who: "player",
					volume: "1.0",
					pitch: "random"
				}
			]
		}
	},

	on_player_use_item : [
		{
			what : "minecraft:book",
			name : GUIDE_BOOK_NAME,
			action : guide_book_show
		}
	],
	
	on_player_break_block : [

	],
	
	on_hurt_entity : [
	
	],
	
	on_script_event_receive : [

	],
	
	on_entity_die_receive : [

	],
	
	notifications : {	// Player notification settings.
		key: "notify_on",
		log: "log_on",
		log_limit: "log_limit",		
		prefix: MSG_PREFIX,
		key_msg: "notify_msg_on",
		key_title: "notify_title_on",
		key_particle: "notify_particle_on",
		key_sound: "notify_sound_on"
	},
	
	constants : { 
		TTL : 25,	// REQUIRED
		PROP_PLAYER_ITERATIONS: "PROP_PLAYER_ITERATIONS",	// REQUIRED
		NOTIFY_LOG_LIMIT: 100, // REQUIRED

		RING_ID: "twf_tor:the_one_ring",
		ENC_ID: "twf_tor:encounter_proto",
		TAG_PROCESSED: "twf_tor:processed_tag",
		CHANCE_AUTO_DROP_ONE_RING: 0.01,
		RING_DAMAGE: 0.2
	}
};

/*  ============================================
	Complex global constants
*/



/*  ===========================================
	Project specific handlers
	(your code goes here)

*/

function convert_proto_encounter(dimension, context) {
	// This would be better triggered as a spawn event. Using the each_dimension method as a demo.
	
	for (let entity of dimension.getEntities( { type: C("ENC_ID"), excludeTags: [C("TAG_PROCESSED")] } )) {
		entity.addTag(C("TAG_PROCESSED"));
		let item = new mc.ItemStack(C("RING_ID"), 1);
		dimension.spawnItem(item, entity.location);

		// This could be a notify()
		dimension.runCommand("/particle twf_tor:ring "+String(entity.location.x)+" "+String(entity.location.y+0.5)+" "+String(entity.location.z));
		dimension.runCommand("/particle twf_tor:rainbow_flame "+String(entity.location.x)+" "+String(entity.location.y+0.5)+" "+String(entity.location.z));
		// entity.runCommandAsync("/setblock ~ ~ ~ sea_lantern");
		// mc.world.sendMessage(JSON.stringify(entity.location, undefined, 2)); // Uncomment to get a message when The One Ring spawns
		entity.triggerEvent('twf_tor:despawn');
	}	
}

function the_one_ring_hop_away(player, context) {

	if(Math.random() > C("CHANCE_AUTO_DROP_ONE_RING")) return;
	
	const inv = convert_inventory_to_map(player);
		
	const slots = inv.get(C("RING_ID"));

	if(!slots) return; // No ring in the inventory

	if(whats_in_equipment_slot(player, "Mainhand")?.typeId == C("RING_ID")) return;

	deplete_item_search(player, C("RING_ID"))	// Purge from inventory
	temporal_extruder.push( { id: "twf_tor", targetTick: mc.system.currentTick+50, location: player.location, callback: (inputs) => {
			const item = new mc.ItemStack(C("RING_ID"), 1);
			player.dimension.spawnItem(item, inputs.location);
			player.sendMessage("You feel lighter...")
		}
	})
}

function gold_weilder_damage(player, context) {
	if(player.hasTag(C("RING_ID"))) player.applyDamage(C("RING_DAMAGE"));
}