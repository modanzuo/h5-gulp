const gulp = require('gulp');
const browserSync = require('browser-sync');
const reload = browserSync.reload;
const htmlmin = require('gulp-htmlmin');
const less = require('gulp-less');
const uglify = require('gulp-uglify');
const babel = require("gulp-babel");
const es2015 = require("babel-preset-es2015");
const clean = require('gulp-clean');
const minimist = require('minimist');
const rev = require('gulp-rev');
const cleancss = require('gulp-clean-css');
const usemin = require('gulp-usemin');
const config = require('./config/pluginConfig');
const autofx = require('gulp-autoprefixer');
const cache = require('gulp-cache');
const notify = require('gulp-notify');
const imagemin = require('gulp-imagemin');
const revCollector = require('gulp-rev-collector')

const knownOptions = {
    string: 'env',
    default: {env: process.env.NODE_ENV || 'dist'}
};

const options = minimist(process.argv.slice(2), knownOptions);
let path = options.env === 'dev' ? 'dev/' : 'dist/';
gulp.task('clean', () => {
    return gulp.src([`./${path}`])
        .pipe(clean())
})

gulp.task('less', () => {
    return gulp.src('app/*/*.less')
        .pipe(less())
        .pipe(autofx(config.autofx))
        .pipe(gulp.dest(path))
        .pipe(reload({stream: true}))
});
gulp.task('js', () => {
    return gulp.src(['app/*/*.js', 'app/*/*/*.js'])
        .pipe(babel({presets: [es2015]}))
        .pipe(gulp.dest(path))
        .pipe(reload({stream: true}));
});
gulp.task("img", () => {
    return gulp.src('app/img/**')
        .pipe(cache(imagemin({
            optimizationLevel: 3,
            progressive: true,
            interlaced: true
        })))
        .pipe(gulp.dest(`${path}img`))
        .pipe(notify({
            message: 'Images task complete'
        }));
})

gulp.task("html", () => {
    return gulp.src('./app/*.html')
        .pipe(gulp.dest(`${path}`))
        .pipe(reload({stream: true}))
})
gulp.task('server-start', ['clean'], () => {
    gulp.start('server');
})
gulp.task('server', ['less', 'img', 'js', 'html'], () => {
    browserSync({
        ...config.browserSync,
        server: {
            baseDir: `./${path}`
        },
    });
    gulp.watch(['app/*/*.less'], ['less']);
    gulp.watch(['app/img/*'], ['img']);
    gulp.watch(['app/*/*.js', 'app/*/*/*.js',], ['js']);
    gulp.watch(['app/*.html'], ['html']);

});

//-------------打包上线
const tempPath = './temp';
//imgmd5，压缩后并用md5进行命名，下面使用revCollector进行路径替换
gulp.task('minifyimgmd5', function () {
    return gulp.src([`${tempPath}/img/*`])
        .pipe(rev())//文件名加MD5后缀
        .pipe(gulp.dest(path + 'img'))//输出到css目录
        .pipe(rev.manifest('rev-img-manifest.json'))//生成一个rev-manifest.json
        .pipe(gulp.dest('rev'));//将 rev-manifest.json 保存到 rev 目录内
});
gulp.task('tmp:clean', () => {
    return gulp.src([tempPath])
        .pipe(clean())
})
gulp.task('tmp:copy', ['tmp:clean'], () => {
    return gulp.src('./app/**/*')
        .pipe(gulp.dest(tempPath))
})

gulp.task('rev', function () {
    //html，针对js,css,img
    return gulp.src(['rev/**/*.json', `${tempPath}/**/*.html`])
        .pipe(revCollector({replaceReved: true}))
        .pipe(gulp.dest(tempPath));
});
gulp.task('rev:js', function () {
    //html，针对js,css,img
    return gulp.src(['rev/**/*.json', `${tempPath}/**/*.js`])
        .pipe(revCollector({replaceReved: true}))
        .pipe(gulp.dest(tempPath));
});
gulp.task('temp:less', () => {
    return gulp.src('app/*/*.less')
        .pipe(less())
        .pipe(autofx(config.autofx))
        .pipe(gulp.dest('temp/'))
        .pipe(reload({stream: true}))
});
gulp.task('rev:img', function () {
    //css，主要是针对img替换
    return gulp.src(['rev/**/rev-img-manifest.json', `${tempPath}/css/*.css`])
        .pipe(revCollector({replaceReved: true}))
        .pipe(gulp.dest(`${tempPath}/css`));
});

gulp.task('build:html', ['minifyimgmd5', 'rev', 'rev:js', 'rev:img'], () => {
    return gulp.src(`${tempPath}/*.html`).pipe(usemin({
        html: [() => {
            return htmlmin(config.htmlmin);
        }],
        js: [babel({presets: [es2015]}), uglify, rev],
        minjs: [babel({presets: [es2015]}), uglify, rev],
        css: [cleancss(config.cleanCSS), rev]
    })).pipe(gulp.dest(tempPath))
});
gulp.task('build:copy', ["build:html"], () => {
    return gulp.src(`${tempPath}/**/*`)
        .pipe(gulp.dest(path))
})
gulp.task("build", ['tmp:copy', 'clean'], () => {
    gulp.start("temp:less", () => {
        gulp.start('build:copy', () => {
            gulp.start("tmp:clean", () => {
                notify({
                    message: '编辑成功!'
                })
            })
        })
    })
})