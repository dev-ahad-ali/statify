import { httpServerHandler } from "cloudflare:node";
import { createApp } from "./app.js";

createApp().listen(8787);
export default httpServerHandler({ port: 8787 });
