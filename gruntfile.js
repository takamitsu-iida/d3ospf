module.exports = function (grunt) {
  var pkg = grunt.file.readJSON('package.json');

  grunt.file.defaultEncoding = 'utf-8';
  grunt.file.preserveBOM = true;

  grunt.initConfig({
    concat: {
      target_js: {
        // 元ファイルの指定
        src: [
          'static/d3.4.3.0/d3.js',
          'static/site/js/d3ospf.startup.js',
          'static/site/js/d3ospf.ospfData.js',
          'static/site/js/d3ospf.checkbox.js',
          'static/site/js/d3ospf.ospfChart.js'
          ],
        // 出力ファイルの指定
        dest: 'static/site/dist/d3ospf.js'
      },
      target_css: {
        src: [
          'static/site/css/d3ospf.css'
          ],
        dest: 'static/site/dist/d3ospf.css'
      }
    },

    uglify: {
      target_js: {
        files: {
          // 出力ファイル: 元ファイル
          'static/site/dist/d3ospf-min.js': ['static/site/dist/d3ospf.js']
        }
      }
    }
  });

  // プラグインのロード・デフォルトタスクの登録
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.registerTask('default', ['concat', 'uglify']);
};
