import "dotenv";

class Config {
	public token: string;
	public dbString: string;

	constructor() {
		this.token = Deno.env.get("TOKEN") || "";
		this.dbString = Deno.env.get("DB_STRING") || "database.db";
	}
}
export default Config;
