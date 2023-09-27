// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const fs = require("fs");
const readline = require("readline");
const SHOW_CONFIRM = "lazy-router-transform.showComfirm"
function writeFile(data, path) {
  // 写入文件，如果不存在，创建，然后写入，如果存在，我们直接覆盖
  fs.writeFile(path, data, function (err) {
    if (err) {
      console.log(err); //文件存在的时候创建会失败
    } else {
      console.log(path + " write success!");
      setTimeout(() => {
        //延时格式化，因为要写文件
        vscode.commands.executeCommand("editor.action.formatDocument");
        setTimeout(() => {
            //延时保存，因为要格式化
            vscode.commands.executeCommand("workbench.action.files.save");
        }, 1000);
      }, 2000);
    }
  });
}

/**
 * 动态替换路由组件路径的函数
 * @param {string} filePath 文件路径
 * @returns {Array} 路由配置数据
 */
function replaceComponentPath(filePath) {
  return new Promise((res, err) => {
    // 使用readline按行读取文件
    const readLine = readline.createInterface({
      input: fs.createReadStream(filePath), // 指定文件路径
      crlfDelay: Infinity,
    });
    // 导入库文件
    let totalBuf = 'import {lazy} from "react";\n';
    const importMap = {};
    // 使用正则表达式匹配以import开始的元素和from后面的路径，将其存储为key-value形式的数据
    readLine.on("line", (line) => {
      if (line.startsWith("import")) {
        const regex = /import\s+(\w+)\s+from\s+['"](.+)['"]/;
        const matchs = line.match(regex);
        if (matchs) {
          importMap[matchs[1]] = matchs[2];
          //如果是引用三方的route，写法可能不一样，因此需要保留import
          if (!line.includes("views")) {
            totalBuf += line + "\n";
          }
        }
      } else {
        if (line.includes("component:") && !line.match(/\s*\/\//)) {
          const findBuf = line.split("component:");
          const regex = /component:\s*(\w+)/;
          const matchs = line.match(regex);
          if (findBuf.length > 1) {
            if (matchs[1] && matchs[1] != "lazy") {
              totalBuf += line.replace(
                matchs[1],
                `lazy(()=>import('${importMap[matchs[1]]}'))`
              );
            }
          } else {
            totalBuf += line + "\n";
          }
        } else {
          totalBuf += line + "\n";
        }
      }
    });
    readLine.on("close", () => {
      //根本就没有需要替换的内容
      if (!totalBuf.includes("component:")) {
        vscode.commands.executeCommand("editor.action.formatDocument");
        res("no need transform");
        return;
      } else {
        //格式化字符串
        const resultStr = totalBuf.replace(/},/g, "},\n");
        writeFile(resultStr, filePath);
        res("transform Success");
      }
    });
  });
}
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function callback(uri) {
  const showComfirm = vscode.workspace
    .getConfiguration()
    .get(SHOW_CONFIRM);
  if (showComfirm) {
    vscode.window
      .showInformationMessage(
        "点击确认，当前文件会被替换，是否继续",
        "是",
        "否",
        "执行，并且不再提示"
      )
      .then((result) => {
        if (result.includes("是")) {
          const filePath = uri ? uri.path : null;
          if (!!filePath) {
            replaceComponentPath(filePath).then((success) => {
              vscode.window.showInformationMessage(success);
            });
          }
          if (result === "是，并且不再提示") {
            // 不在提示，关闭showDialog
            vscode.workspace.getConfiguration().update(SHOW_CONFIRM, false, true);
          }
        }
      });
  } else {
    const filePath = uri ? uri.path : null;
    if (!!filePath) {
      replaceComponentPath(filePath).then((success) => {
        vscode.window.showInformationMessage(success);
      });
    }
  }
}
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log(
    'Congratulations, your extension "lazy-router-transform" is now active!'
  );

  let disposable = vscode.commands.registerCommand(
    "lazy-router-transform.handleFile",
    callback
  );

  let disposableGetPath = vscode.commands.registerCommand(
    "lazy-router-transform.getPath",
    callback
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(disposableGetPath);
}

// This method is called when your extension is deactivated
function deactivate() {
  console.log("您的扩展“lazy-router-transform”已被释放！");
}

module.exports = {
  activate,
  deactivate,
};
