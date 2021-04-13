const core = require('@actions/core');
const github = require('@actions/github');

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const cheerio = require("cheerio");

async function domDump(url) {
  const browser = await puppeteer.launch({headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"]});
  const page = await browser.newPage();
  await page.goto(url, {waitUntil: 'networkidle0'});
  const html = await page.content();
  await browser.close();
  return html;
}

function copy_path(src, dst){
  console.log("Copy", src, dst);
  let dst_dir = path.dirname(dst);
  if (!fs.existsSync(dst_dir)){
    fs.mkdirSync(dst_dir, { recursive: true });
  }
  fs.copyFileSync(src, dst);
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
  if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir);
  }

  files.forEach(function(file) {
    if (file.substring(file.length - '.md.html'.length, file.length) === '.md.html') {
        file = file.substring(0, file.length - '.md.html'.length);
    }

    var markdeepFile = path.join(process.cwd(), file + '.md.html');
    let src_dir = path.dirname(markdeepFile);
    var outputFile = path.join(outputDir, path.basename(file + '.html'));
    let dst_dir = path.dirname(outputFile);
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

        // relocate files
        if(path.normalize(src_dir) !== path.normalize(dst_dir)){
          $('img').each( (i, element) => {
            let src = $(element).attr('src');
            if(!path.isAbsolute(src)){
              img_abs_src = path.resolve(src_dir, src);
              img_abs_dst = path.resolve(dst_dir, src);
              copy_path(img_abs_src, img_abs_dst);
            }
          });
          // Probably add other potential files
        }

        console.log(`Saving rasterized file: ${outputFile}`);
        fs.writeFile(outputFile, $.html(), function(err) {
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