/**
 * Node 包引入
 */
let shell = require('shelljs');
const images = require("images");
const getPixels = require("get-pixels");
/**
 * 常量配置引入
 */
const {
  IMG_NAME,
  LOCAL_IMG_PATH
} = require("./config/constant")

// 获取安卓分辨率
let getAndroidScreen = () => {
  return new Promise((resolve, reject) => {
    shell.exec('adb shell "dumpsys window | grep mUnrestrictedScreen"', function (code, stdout, stderr) {
      if (code == 0) {
        var newStdout = stdout.split(')')[1].match(/(\d+)(\d+)/g)
        resolve({
          x: ~~newStdout[0],
          y: ~~newStdout[1]
        })
      }
      reject()
    })
  })
}

let get_center_point = (img, config, callback) => {
  getPixels(LOCAL_IMG_PATH + IMG_NAME, function(err, pixels) {
    if(err) {
      console.log("Bad image path")
      return
    }
    let data = find_poit(pixels, img, config)
    callback(data)
  })
}

let find_poit = (pixels, img, config) => {
  // 查找目标位置
  let piece_x_sum = 0,
      piece_x_c = 0,
      piece_y_max = 0,
      board_x = 0,
      board_y = 0;
  let { width, height } = img.size()
  let scan_x_border = Math.ceil(width/2) // 扫描棋子时的左右边界
  let scan_start_y = 0  // 扫描的起始 y 坐标
  // 以 50px 步长，尝试探测 scan_start_y
  for(let y = Math.ceil(height/3); y < Math.ceil(height*2/3); y+=50) {
    let last_pixel0 = pixels.get(0, y, 0);
    let last_pixel1 = pixels.get(0, y, 1);
    let last_pixel2 = pixels.get(0, y, 2);
    for(var x = 1; x < width; x ++) {
      let pixel0 = pixels.get(x, y, 0),
          pixel1 = pixels.get(x, y, 1),
          pixel2 = pixels.get(x, y, 2);
      // 不是纯色的线，则记录 scan_start_y 的值，准备跳出循环
      if (pixel0 != last_pixel0 || pixel1 != last_pixel1 || pixel2 != last_pixel2) {
        scan_start_y = y - 50
        break
      }
    }
    if(scan_start_y) {
      break
    }
  }
  console.info(`scan_start_y: ${scan_start_y}`)

  // 从 scan_start_y 开始往下扫描，棋子应位于屏幕上半部分，这里暂定不超过 2/3
  for(let y = scan_start_y; y < Math.ceil(height*2/3); y++) {
      for(let x = scan_x_border; x < (width - scan_x_border); x++){  // 横坐标方面也减少了一部分扫描开销
        let pixel0 = pixels.get(x, y, 0),
            pixel1 = pixels.get(x, y, 1),
            pixel2 = pixels.get(x, y, 2);
        // 根据棋子的最低行的颜色判断，找最后一行那些点的平均值，这个颜色这样应该 OK，暂时不提出来
        if ((50 < pixel0 && pixel0 < 60) && (53 < pixel1 && pixel1 < 63) && (95 < pixel2 && pixel2 < 110)) {
          piece_x_sum += x
          piece_x_c += 1
          piece_y_max = y > piece_y_max ? y : piece_y_max
        }
      }
  }
  if (piece_x_sum || piece_x_c) {
    return 0, 0, 0, 0
  }
  piece_x = Math.ceil(piece_x_sum / piece_x_c)
  piece_y = piece_y_max - config.half_height  // 上移棋子底盘高度的一半

  // 限制棋盘扫描的横坐标，避免音符 bug
  if(piece_x < width/2){
    board_x_start = piece_x
    board_x_end = width
  } else {
    board_x_start = 0
    board_x_end = piece_x
  }
  let cur_y = 0 // 记录本次循环最大值 用作下一次处理
  for(cur_y = Math.ceil(height/2); cur_y < Math.ceil(height*2/3); cur_y++) {
    let last_pixel0 = pixels.get(0, cur_y, 0);
    let last_pixel1 = pixels.get(0, cur_y, 1);
    let last_pixel2 = pixels.get(0, cur_y, 2);
    if (board_x || board_y) {
      break
    }
    board_x_sum = 0
    board_x_c = 0
    for(let x = Math.ceil(board_x_start); x < Math.ceil(board_x_end);x++) {
      let pixel0 = pixels.get(x, y, 0),
          pixel1 = pixels.get(x, y, 1),
          pixel2 = pixels.get(x, y, 2);
      // 修掉脑袋比下一个小格子还高的情况的 bug
      if (Math.abs(x - piece_x) < piece_body_width) {
        continue
      }
      // 修掉圆顶的时候一条线导致的小 bug，这个颜色判断应该 OK，暂时不提出来
      if (Math.abs(pixel0 - last_pixel0) + Math.abs(pixel1 - last_pixel1) + Math.abs(pixel2 - last_pixel2) > 10){
        board_x_sum += x
        board_x_c += 1
        img.draw(images(10,10).fill(0xff, 0x00, 0x00, 0.5), x, y).save('2.png')
      }

    }
    if (board_x_sum) {
      board_x = board_x_sum / board_x_c
    }
  }
  let last_pixel0 = pixels.get(board_x, cur_y, 0);
  let last_pixel1 = pixels.get(board_x, cur_y, 1);
  let last_pixel2 = pixels.get(board_x, cur_y, 2);
  // 从上顶点往下 +274 的位置开始向上找颜色与上顶点一样的点，为下顶点
  // 该方法对所有纯色平面和部分非纯色平面有效，对高尔夫草坪面、木纹桌面、药瓶和非菱形的碟机（好像是）会判断错误
  let down_y = 0
  for(down_y = cur_y + 274; down_y < cur_y; down_y--) {
    let pixel0 = pixels.get(board_x, i, 0),
      pixel1 = pixels.get(board_x, i, 1),
      pixel2 = pixels.get(board_x, i, 2);
    if(Math.abs(pixel0 - last_pixel0) + Math.abs(pixel1 - last_pixel1) + Math.abs(pixel[2] - last_pixel[2]) < 10){
      break
    }
  }
  board_y = Math.ceil((cur_y + down_y) / 2)
  // 如果上一跳命中中间，则下个目标中心会出现 r245 g245 b245 的点，利用这个属性弥补上一段代码可能存在的判断错误
  // 若上一跳由于某种原因没有跳到正中间，而下一跳恰好有无法正确识别花纹，则有可能游戏失败，由于花纹面积通常比较大，失败概率较低
  for(let i = cur_y; i < cur_y + 200; i++) {
    let pixel0 = pixels.get(board_x, i, 0),
      pixel1 = pixels.get(board_x, i, 1),
      pixel2 = pixels.get(board_x, i, 2);
    if(Math.abs(pixel0 - 245) + Math.abs(pixel1 - 245) + Math.abs(pixel2 - 245) == 0) {
      board_y = i + 10
      break
    }
  }
  if (board_x || board_y) {
    return [0,0,0,0]
  }
  return [piece_x, piece_y, board_x, board_y]
}
// 获取截图
let upload_phone_img = () => {
  return new Promise((resolve) => {
    console.info('>>>>>>>>>>>截取图片')
    shell.exec(`adb shell screencap -p /sdcard/${IMG_NAME}`, () => {
      console.info('>>>>>>>>>>>上传图片')
      shell.exec(`adb pull /sdcard/${IMG_NAME}`, () => {
        console.info('>>>>>>>>>>>图片上传完成')
        resolve()
      })
    })
  })
}
let androidJump = (distance) => {
  press_time = distance * config.press_radio
  press_time = press_time > 200 ? press_time : 200
  press_time = ~~press_time
  // TODO: 坐标根据截图的 size 来计算
  let { x1, x2, y1, y2 } = config.swipe
  let cmd = `adb shell input swipe ${x1} ${y1} ${x2} ${y2} ${press_time}`
  console.info(`>>>>>>>>>>>>>>>${cmd}`)
  shell.exec(cmd)
}

// 初始化
function init(img) {
  // upload_phone_img().then(() => {
    let curImg = img(LOCAL_IMG_PATH + IMG_NAME)
    getAndroidScreen().then((screen) => {
      let config = require(`./config/screen/${screen.x}-${screen.y}.json`)
      get_center_point(curImg, config, ([piece_x, piece_y, board_x, board_y]) => {
        // curImg.draw(img(8,8).fill(0xff, 0x00, 0x00, 0.5), piece_x, piece_y).save('1.png')
        // curImg.draw(img(8,8).fill(0,0,0), board_x, board_x).save('1.png')
        console.log(piece_x, piece_y, board_x, board_x)
        // androidJump(Math.sqrt(Math.abs(board_x - piece_x) ** 2 + Math.abs(board_y - piece_y) ** 2), config)
        // setTimeout(() => {
        //   init(img)
        // }, 3500)
      })
    })
  // })
}
init(images)
// function TylerJump() {
//   this.version = '1.0.1'
//   this.author = 'Tyler'
// }
// TylerJump.prototype.get_center_point = get_center_point
// TylerJump.prototype.upload_phone_img = upload_phone_img
// TylerJump.prototype.init = init
// let tyler = new TylerJump()
// tyler.init()
