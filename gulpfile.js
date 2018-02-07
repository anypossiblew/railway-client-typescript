var gulp = require("gulp");
var ts = require("gulp-typescript");
var merge = require('merge2');

var tsProject = ts.createProject("tsconfig.json");

gulp.task("default", function () {
    var tsResult = tsProject.src()
        .pipe(tsProject());

    return merge([
        tsResult.dts.pipe(gulp.dest('dist')),
        tsResult.js.pipe(gulp.dest('dist'))
    ]);
});
