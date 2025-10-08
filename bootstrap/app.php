<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use App\Http\Middleware\BindCycleFromRoute;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'bind.cycle' => BindCycleFromRoute::class,
        ]);
        // optionally add to the web group globally:
        // $middleware->appendToGroup('web', BindCycleFromRoute::class);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
