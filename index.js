const { OpenAI } = require("openai");
const xlsx = require("xlsx");
const ScrapingAntClient = require('@scrapingant/scrapingant-client');
const cheerio = require('cheerio');
const xmldom = require('xmldom').DOMParser;
const xpath = require('xpath');
const fs = require('fs');

const client = new ScrapingAntClient({ apiKey: '3b03950ccb7e41ff9f66b98c8eb1e190' });

const openai = new OpenAI({ apiKey: "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" });

(async function () {
    try {

        const workbook = xlsx.readFile("hyundai Boodmo LL .xlsx");
        const worksheet = workbook.Sheets[workbook.SheetNames[1]];
        const jsonArray = xlsx.utils.sheet_to_json(worksheet);

        const finalArr = JSON.parse(fs.readFileSync("hyundai_generated_titles_7.json", "utf8"));

        const existingTitles = JSON.parse(fs.readFileSync("hyundai_generated_titles_7.json", "utf8"));

        // const finalArr = [];
        for (var i = 0; i < jsonArray.length; i++) {

            console.log(i, jsonArray[i].id);

            if (existingTitles.find(itm => itm.id === jsonArray[i].id)) {
                console.log("Already Exists");
                const genratedTitle = existingTitles.find(itm => itm.id === jsonArray[i].id).generatedTitle;
                finalArr.push({ ...jsonArray[i], genratedTitle: genratedTitle });
                fs.writeFileSync("hyundai_generated_titles_7.json", JSON.stringify(finalArr), "utf8");
                continue;
            }

            // const created = createdListing.find(itm => itm.id === jsonArray[i].id);
            // if (!created || created.status != "Success") {
            //     console.log("Not Created");
            //     continue;
            // }

            const title = jsonArray[i].title;
            const comp = jsonArray[i].description;
            const aspNames = ["Make", "Model", "Year", "Part Number", "Part Name", "Fitting Position"];

            const productLink = jsonArray[i].link;

            let html = '';
            try {
                // const browser = await puppeteer.launch({
                //     headless: true,
                //     args: ['--no-sandbox', '--disable-setuid-sandbox', "--proxy-server=http://p.webshare.io:80"]
                // });
                // const page = await browser.newPage();
                // await page.authenticate({ username: 'kqahvuvn-rotate', password: '22suvhg9seb1' });
                // await page.goto(productLink, { waitUntil: 'networkidle2' });

                const response = await client.scrape(productLink, { browser: true, proxy_type: "datacenter", proxy_country: "IN", wait_for_selector: "#compatibility > div:nth-child(1) > h3" });

                html = response.content;
                // await new Promise((resolve, reject) => {
                //     setTimeout(() => {
                //         resolve();
                //     }, 5000);
                // });
                // html = await page.content();
            } catch (err) {
                console.error(err);
                continue;
            }


            // fs.writeFileSync("hyundai.html", html, "utf8");
            try {
                const $ = cheerio.load(html);

                const doc = new xmldom().parseFromString($.xml(), 'text/xml');

                const productTitle = jsonArray[i].short_title

                // Load the HTML into Cheerio
                const yearCh = cheerio.load(comp);

                // Select the first <li> element and extract its text
                const firstListItemText = yearCh('ul > li:first-child').text();

                // Regex to extract the date range
                const dateRangeRegex = /\d{2}\.\d{4}-\d{2}\.\d{4}/;
                const dateRange = firstListItemText.match(dateRangeRegex);;

                const year = dateRange ? dateRange[0] : "";

                const fitmentPos = xpath.select1("//span[@class='specification__item__name' and contains(text(), 'Fitting Position')]/following-sibling::span", doc)?.textContent.trim();

                // console.log(productTitle, fitmentPos);
                const response = await openai.chat.completions.create({
                    messages: [{
                        "role": "system", "content": `Title:- ${title}, Sub Title: ${productTitle} Model -> ${comp}, Year -> ${year}, Make -> "Hyundai", Fitting Position -> ${fitmentPos ?? ''}, Part Number -> ${jsonArray[i].mpn}, Part Name -> ${jsonArray[i].product_type},
                                Based on the text above make a title which has these information -> ${aspNames.join(", ")}.
                                The title should be in the format: "{Make} {Model} {Year} {Fitting Position} {Part Number} {Part Name} {type}".
                                Important parameters -> Make, Model, Year, Fitting Position, Part Number.
                                Year, part name, Fitting Position and part number should be present in the title.
                                Remove the keyword "Accent" from the Title.
                                Prioritize other relevant models like Creta,i10,120,Venue, if these models come then they should be present in title even if removing other models are required.
                                Important:- The title should not exceed character limit of 80.
                                If possible try to add all the models name in the title.
                                `}],
                    model: "gpt-4o",
                });
                // console.log(response.choices[0].message.content);

                const genratedTitle = response.choices[0].message.content;

                // const fitment_res = await openai.chat.completions.create({
                //     messages: [{
                //         "role": "system", "content": `
                //                 Fitting Position -> ${fitmentPos}, product title -> ${productTitle}
                //                 Rewrite the product title to include the Fitting Position without changing the title very mych.
                //                 Important:- The title should not exceed character limit of 80.
                //                 If possible try to add all the models name in the title.
                //                 `}],
                //     model: "gpt-4o",
                // });

                const titleWithFitment = genratedTitle;

                const finalObj = {
                    ...jsonArray[i],
                    genratedTitle: titleWithFitment,
                    fitmentPos: fitmentPos,
                };

                finalArr.push(finalObj);
                fs.writeFileSync("hyundai_generated_titles_7.json", JSON.stringify(finalArr), "utf8");
            } catch (err) {
                console.error(err);
                const finalObj = {
                    ...jsonArray[i],
                    error: err.meta ?? err,
                    status: err.message
                };

                finalArr.push(finalObj);
                fs.writeFileSync("hyundai_generated_titles_7.json", JSON.stringify(finalArr), "utf8");
            }
        }
        console.log(finalArr.length);
        // const parser = new Parser();
        // const csv = parser.parse(finalArr);

        // require("fs").writeFileSync("hyundai_generated_titles.csv", csv, "utf8");

    } catch (err) {
        console.error(err);
    }
}
)();