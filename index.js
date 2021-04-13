const core = require('@actions/core');
const github = require('@actions/github');

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const cheerio = require("cheerio");

const markdeepScripts = [
  '<script src="https://casual-effects.com/markdeep/latest/markdeep.min.js"></script>',
  '<script src="https://morgan3d.github.io/markdeep/latest/markdeep.min.js?" charset="utf-8"></script>'
]

async function domDump(url) {
  const browser = await puppeteer.launch({headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"]});
  const page = await browser.newPage();
  await page.goto(url, {waitUntil: 'networkidle0'});
  const html = await page.content();
  await browser.close();
  return html;
}

try {
  let files = [];
  if(process.argv.length < 3){
    files.push("./docs/index.md.html")
  }else{
    files = process.argv.slice(2);
  }
  console.log(`FILES: ${files}`);
  const outputDir = core.getInput('out-dir');
  console.log(`OUTPUT: ${outputDir}`);

  files.forEach(function(file) {
    if (file.substring(file.length - '.md.html'.length, file.length) === '.md.html') {
        file = file.substring(0, file.length - '.md.html'.length);
    }

    var markdeepFile = path.join(process.cwd(), file + '.md.html');
    var outputFile = path.basename(file + '.html');

    domDump('file://' + markdeepFile + '?export').then(function(dom) {
        console.log('Processing ' + markdeepFile + '...');

        // Parse the DOM
        var $ = cheerio.load(dom);
        // Because of ?export Markdeep generated the output in a <pre> tag
        dom = $('pre').text();
        // We must remove the remaining invocation of Markdeep
        dom = dom.replace(/<script src=".*markdeep.*".*><\/script>/g, '');
        // Now replace <pre> with its own content so we can preserve headers
        $('pre').replaceWith(dom);
        const outputPath = path.join(outputDir, outputFile);
        console.log(`Saving rasterized file: ${outputPath}`);
        fs.writeFile(outputPath, $.html(), function(err) {
            if (err) console.log(err);
        });
    }).catch(function(e) {
        console.log(`Could no process ${markdeepFile} : ${e}`);
    });
  });

  console.log(`OUTPUT: ${outputDir}!`);
  core.setOutput("out-dir", outputDir);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}