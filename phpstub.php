<?php

// Stub for IDE to recognize Imagick and stop red underline.
// This will never run because Imagick already exists in runtime.
if (!class_exists('Imagick')) {
    class Imagick {
        public function __construct($file = null) {}
        public function setResolution($x, $y) {}
        public function setImageFormat($format) {}
        public function addImage($img) {}
        public function mergeImageLayers($type) {}
    }
}
