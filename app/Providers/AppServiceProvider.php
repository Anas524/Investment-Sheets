<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\View;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Don’t query during artisan commands (e.g., migrate)
        if ($this->app->runningInConsole()) {
            View::share('sheetNames', []);
            return;
        }

        // Only query if the table exists
        if (Schema::hasTable('customer_sheets')) {
            $names = DB::table('customer_sheets')->pluck('sheet_name')->all();
            View::share('sheetNames', $names);
        } else {
            View::share('sheetNames', []);
        }
    }
}
