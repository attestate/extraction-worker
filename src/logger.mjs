import debug from "debug";

const name = "@attestate/extraction-worker";
const log = (subname) => debug(`${name}:${subname}`);
export default log;
