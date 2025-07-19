// import { log } from "console";
import express, { Request, Response } from "express";

const app = express();
const port = 4000;

app.get('/', (req: Request, res: Response) => {
    res.send("App Working");
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);

})