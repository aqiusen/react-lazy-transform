// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const fs = require("fs");
const readline = require("readline");
const parser = require('@babel/parser')// 代码转AST工具
const traverse = require('@babel/traverse').default //AST遍历器
const generate = require('@babel/generator').default;
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

function handleELements(ImportMaps, elements) {
    if (!!elements && elements.length > 0) {
        elements.forEach(el => {
            const compItem = (el.properties || []).find(item => item.key.name === "component");
            if (!!compItem) {
                compItem.value.name = `lazy(() => import('${ImportMaps[compItem.value.name]}'))`
            }
            const childrenItem = (el.properties || []).find(item => item.key.name === "children");
            if (!!childrenItem && childrenItem.value.elements.length > 0) {
                handleELements(ImportMaps, childrenItem.value.elements)
            }
        })
    }
}
/**
 * 动态替换路由组件路径的函数
 * @param {string} filePath 文件路径
 * @returns {Array} 路由配置数据
 */
function replaceComponentPath(filePath) {
    return new Promise((res, err) => {
        //实现方式 2 ，通过 ast 实现修改内容，然后显示
        // 读取文件中的代码  使用babel/parser转为AST
        const code = fs.readFileSync(filePath, 'utf-8')
        const ImportMaps = {}
        const ast = parser.parse(code, {
            sourceType: 'module'
        })

        // 使用babel/traverse遍历AST
        // 二号参数为AST的visitor 传入对应的钩子函数,每当遍历到对应的语句即执行这个钩子函数
        // 我们这里的console语句是一句'ExpressionStatement' 我们使用这个钩子读取它
        // 钩子函数接收path参数  path.node即为当前语句的AST
        traverse(ast, {
            ExpressionStatement: (path, state) => {
                const name = path.node.expression.callee.object.name
            },
            // 导包文件
            ImportDeclaration: (path, state) => {
                const importName = path.node.specifiers[0].local.name
                ImportMaps[importName] = path.node.source.value
                if(!ImportMaps[importName].includes("@/routes/")) {
                    path.remove();
                }
            },
            VariableDeclaration: (path, state) => {
                const elements = path.node.declarations[0].init.elements;
                handleELements(ImportMaps, elements);
            },
            /**
             * 为了支持export default [{}] 这种类型写法
             * @param {*} path
             * @param {*} state
             */
            ExportDefaultDeclaration: (path, state) => {
                const elements = path.node.declaration.elements;
                handleELements(ImportMaps, elements);
            }
        })
        // 解决 babel 乱码问题：{jsescOption: {"minimal": true}}
        const jsCode = generate(ast, { jsescOption: { "minimal": true } })
        console.log(jsCode)
        // 将导包加入文件最顶部：
        const result = `import { lazy } from "react";\n` + jsCode.code;
        writeFile(result, filePath);
        res("transform Success");
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
