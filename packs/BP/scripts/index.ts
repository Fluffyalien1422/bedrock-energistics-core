// tell the api that it is embedded in BEC
import { __INIT_BEC__ } from "@/public_api/src/init";
import { VERSION_STR } from "./constants";
__INIT_BEC__(VERSION_STR);
//

// imports
import "./custom_components";
import "./debug_commands";
import "./ipc_listeners";
import "./ui";
