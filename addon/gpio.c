// -------------------------------------------------------------------
// RPI-IO: - gpio.c v38 - 2025-11-19
// source: claude.ai/chat/f3139163-e976-47a4-8e46-01fee65686f2
// -------------------------------------------------------------------

#include <node_api.h>
#include <gpiod.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <unistd.h>
#include <errno.h>
#include <time.h>

// La version de libgpiod est détectée par binding.gyp et passée comme define
// LIBGPIOD_V2 ou LIBGPIOD_V1
#if defined(LIBGPIOD_V2)
  // #pragma message "Compiling with libgpiod v2.x API"
#elif defined(LIBGPIOD_V1)
  // #pragma message "Compiling with libgpiod v1.x API"
#else
  #error "Cannot detect libgpiod version. Please ensure detect-gpiod-version.sh is executable."
#endif

// Structure pour stocker les lignes GPIO ouvertes
typedef struct {
#ifdef LIBGPIOD_V2
    struct gpiod_chip *chip;
    struct gpiod_line_request *request;
    struct gpiod_line_settings *line_settings;
    struct gpiod_line_config *line_cfg;
    struct gpiod_request_config *req_cfg;
    unsigned int offset;
#else
    struct gpiod_chip *chip;
    struct gpiod_line *line;
#endif
    int line_num;
    int is_output;
    int is_closed;

    // Pour le monitoring
    int is_monitoring;
    pthread_t monitor_thread;
    napi_threadsafe_function tsfn;
    napi_ref callback_ref;
} gpio_context_t;

// Libérer les ressources GPIO
static void finalize_gpio(napi_env env, void* finalize_data, void* finalize_hint) {
    gpio_context_t *ctx = (gpio_context_t*)finalize_data;
    if (ctx) {
        // Arrêter le monitoring si actif
        if (ctx->is_monitoring) {
            ctx->is_monitoring = 0;
            if (ctx->monitor_thread) {
                pthread_join(ctx->monitor_thread, NULL);
            }
        }

        if (ctx->tsfn) {
            napi_release_threadsafe_function(ctx->tsfn, napi_tsfn_abort);
            ctx->tsfn = NULL;
        }

        // Ne pas utiliser callback_ref ici car nous n'avons plus d'environnement valide
        ctx->callback_ref = NULL;

        // Ne libérer que si pas déjà fermé
        if (!ctx->is_closed) {
#ifdef LIBGPIOD_V2
            if (ctx->request) {
                gpiod_line_request_release(ctx->request);
                ctx->request = NULL;
            }
            if (ctx->line_settings) {
                gpiod_line_settings_free(ctx->line_settings);
                ctx->line_settings = NULL;
            }
            if (ctx->line_cfg) {
                gpiod_line_config_free(ctx->line_cfg);
                ctx->line_cfg = NULL;
            }
            if (ctx->req_cfg) {
                gpiod_request_config_free(ctx->req_cfg);
                ctx->req_cfg = NULL;
            }
            if (ctx->chip) {
                gpiod_chip_close(ctx->chip);
                ctx->chip = NULL;
            }
#else
            if (ctx->line) {
                gpiod_line_release(ctx->line);
                ctx->line = NULL;
            }
            if (ctx->chip) {
                gpiod_chip_close(ctx->chip);
                ctx->chip = NULL;
            }
#endif
            ctx->is_closed = 1;
        }
        free(ctx);
    }
}

// Fonction: GetVersion() - Retourne la version de libgpiod utilisée
static napi_value GetVersion(napi_env env, napi_callback_info info) {
    napi_value result;
    const char* version;

#ifdef LIBGPIOD_V2
    version = gpiod_api_version();
#else
    version = gpiod_version_string();
#endif

    if (version == NULL) {
        version = "unknown";
    }

    napi_status status = napi_create_string_utf8(env, version, NAPI_AUTO_LENGTH, &result);
    if (status != napi_ok) {
        napi_throw_error(env, NULL, "Failed to create version string");
        return NULL;
    }

    return result;
}

// Fonction: openOutput(chipName, lineNumber, initialValue, bias)
static napi_value OpenOutput(napi_env env, napi_callback_info info) {
    napi_status status;
    size_t argc = 4;
    napi_value args[4];
    char chip_name[256];
    size_t chip_name_len;
    int line_num, initial_value;
    char bias_str[32] = "disable";

    status = napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    if (status != napi_ok || argc < 2) {
        napi_throw_error(env, NULL, "Expected chipName and lineNumber arguments");
        return NULL;
    }

    status = napi_get_value_string_utf8(env, args[0], chip_name, sizeof(chip_name), &chip_name_len);
    if (status != napi_ok) {
        napi_throw_error(env, NULL, "Invalid chip name");
        return NULL;
    }

    status = napi_get_value_int32(env, args[1], &line_num);
    if (status != napi_ok) {
        napi_throw_error(env, NULL, "Invalid line number");
        return NULL;
    }

    if (argc >= 3) {
        napi_valuetype valuetype;
        status = napi_typeof(env, args[2], &valuetype);
        if (status == napi_ok && valuetype == napi_number) {
            napi_get_value_int32(env, args[2], &initial_value);
        }
    }

    if (argc >= 4) {
        napi_valuetype valuetype;
        status = napi_typeof(env, args[3], &valuetype);
        if (status == napi_ok && valuetype == napi_string) {
            napi_get_value_string_utf8(env, args[3], bias_str, sizeof(bias_str), NULL);
        }
    }

    gpio_context_t *ctx = (gpio_context_t*)malloc(sizeof(gpio_context_t));
    if (!ctx) {
        napi_throw_error(env, NULL, "Memory allocation failed");
        return NULL;
    }
    memset(ctx, 0, sizeof(gpio_context_t));

    ctx->line_num = line_num;
    ctx->is_output = 1;
    ctx->is_closed = 0;
    ctx->is_monitoring = 0;
    ctx->monitor_thread = 0;
    ctx->tsfn = NULL;
    ctx->callback_ref = NULL;

#ifdef LIBGPIOD_V2
    ctx->chip = gpiod_chip_open(chip_name);
    if (!ctx->chip) {
        free(ctx);
        napi_throw_error(env, NULL, "Failed to open GPIO chip (v2)");
        return NULL;
    }

    ctx->offset = (unsigned int)line_num;

    // Créer les structures de configuration
    ctx->line_settings = gpiod_line_settings_new();
    ctx->line_cfg = gpiod_line_config_new();
    ctx->req_cfg = gpiod_request_config_new();

    if (!ctx->line_settings || !ctx->line_cfg || !ctx->req_cfg) {
        if (ctx->line_settings) gpiod_line_settings_free(ctx->line_settings);
        if (ctx->line_cfg) gpiod_line_config_free(ctx->line_cfg);
        if (ctx->req_cfg) gpiod_request_config_free(ctx->req_cfg);
        gpiod_chip_close(ctx->chip);
        free(ctx);
        napi_throw_error(env, NULL, "Failed to create config structures");
        return NULL;
    }

    // Configurer les line_settings pour une sortie
    gpiod_line_settings_set_direction(ctx->line_settings, GPIOD_LINE_DIRECTION_OUTPUT);
    gpiod_line_settings_set_output_value(ctx->line_settings,
        initial_value ? GPIOD_LINE_VALUE_ACTIVE : GPIOD_LINE_VALUE_INACTIVE);

    // Ajouter les settings à la config pour cette ligne spécifique
    int ret = gpiod_line_config_add_line_settings(ctx->line_cfg, &ctx->offset, 1, ctx->line_settings);
    if (ret < 0) {
        gpiod_line_settings_free(ctx->line_settings);
        gpiod_line_config_free(ctx->line_cfg);
        gpiod_request_config_free(ctx->req_cfg);
        gpiod_chip_close(ctx->chip);
        free(ctx);
        napi_throw_error(env, NULL, "Failed to add line settings");
        return NULL;
    }

    // Configurer le consumer
    gpiod_request_config_set_consumer(ctx->req_cfg, "nodejs-gpio");

    // Demander la ligne
    ctx->request = gpiod_chip_request_lines(ctx->chip, ctx->req_cfg, ctx->line_cfg);
    if (!ctx->request) {
        gpiod_line_settings_free(ctx->line_settings);
        gpiod_line_config_free(ctx->line_cfg);
        gpiod_request_config_free(ctx->req_cfg);
        gpiod_chip_close(ctx->chip);
        free(ctx);
        napi_throw_error(env, NULL, "Failed to request line as output (v2)");
        return NULL;
    }
#else
    ctx->chip = gpiod_chip_open(chip_name);
    if (!ctx->chip) {
        free(ctx);
        napi_throw_error(env, NULL, "Failed to open GPIO chip (v1)");
        return NULL;
    }

    ctx->line = gpiod_chip_get_line(ctx->chip, line_num);
    if (!ctx->line) {
        gpiod_chip_close(ctx->chip);
        free(ctx);
        napi_throw_error(env, NULL, "Failed to get GPIO line");
        return NULL;
    }

    int ret = gpiod_line_request_output(ctx->line, "nodejs-gpio", initial_value);
    if (ret < 0) {
        gpiod_chip_close(ctx->chip);
        free(ctx);
        napi_throw_error(env, NULL, "Failed to request line as output (v1)");
        return NULL;
    }
#endif

    napi_value external;
    status = napi_create_external(env, ctx, finalize_gpio, NULL, &external);
    if (status != napi_ok) {
        finalize_gpio(env, ctx, NULL);
        napi_throw_error(env, NULL, "Failed to create external");
        return NULL;
    }

    return external;
}

// Fonction: openInput(chipName, lineNumber, bias)
static napi_value OpenInput(napi_env env, napi_callback_info info) {
    napi_status status;
    size_t argc = 3;
    napi_value args[3];
    char chip_name[256];
    size_t chip_name_len;
    int line_num;
    char bias_str[32] = "disable";

    status = napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    if (status != napi_ok || argc < 2) {
        napi_throw_error(env, NULL, "Expected chipName and lineNumber arguments");
        return NULL;
    }

    status = napi_get_value_string_utf8(env, args[0], chip_name, sizeof(chip_name), &chip_name_len);
    if (status != napi_ok) {
        napi_throw_error(env, NULL, "Invalid chip name");
        return NULL;
    }

    status = napi_get_value_int32(env, args[1], &line_num);
    if (status != napi_ok) {
        napi_throw_error(env, NULL, "Invalid line number");
        return NULL;
    }

    if (argc >= 3) {
        napi_valuetype valuetype;
        status = napi_typeof(env, args[2], &valuetype);
        if (status == napi_ok && valuetype == napi_string) {
            napi_get_value_string_utf8(env, args[2], bias_str, sizeof(bias_str), NULL);
        }
    }

    gpio_context_t *ctx = (gpio_context_t*)malloc(sizeof(gpio_context_t));
    if (!ctx) {
        napi_throw_error(env, NULL, "Memory allocation failed");
        return NULL;
    }
    memset(ctx, 0, sizeof(gpio_context_t));

    ctx->line_num = line_num;
    ctx->is_output = 0;
    ctx->is_closed = 0;
    ctx->is_monitoring = 0;
    ctx->monitor_thread = 0;
    ctx->tsfn = NULL;
    ctx->callback_ref = NULL;

#ifdef LIBGPIOD_V2
    ctx->chip = gpiod_chip_open(chip_name);
    if (!ctx->chip) {
        free(ctx);
        napi_throw_error(env, NULL, "Failed to open GPIO chip (v2)");
        return NULL;
    }

    ctx->offset = (unsigned int)line_num;

    // Créer les structures de configuration
    ctx->line_settings = gpiod_line_settings_new();
    ctx->line_cfg = gpiod_line_config_new();
    ctx->req_cfg = gpiod_request_config_new();

    if (!ctx->line_settings || !ctx->line_cfg || !ctx->req_cfg) {
        if (ctx->line_settings) gpiod_line_settings_free(ctx->line_settings);
        if (ctx->line_cfg) gpiod_line_config_free(ctx->line_cfg);
        if (ctx->req_cfg) gpiod_request_config_free(ctx->req_cfg);
        gpiod_chip_close(ctx->chip);
        free(ctx);
        napi_throw_error(env, NULL, "Failed to create config structures");
        return NULL;
    }

    // Configurer les line_settings pour une entrée
    gpiod_line_settings_set_direction(ctx->line_settings, GPIOD_LINE_DIRECTION_INPUT);

    // Configurer le bias
    if (strcmp(bias_str, "pull-up") == 0) {
        gpiod_line_settings_set_bias(ctx->line_settings, GPIOD_LINE_BIAS_PULL_UP);
    } else if (strcmp(bias_str, "pull-down") == 0) {
        gpiod_line_settings_set_bias(ctx->line_settings, GPIOD_LINE_BIAS_PULL_DOWN);
    } else {
        gpiod_line_settings_set_bias(ctx->line_settings, GPIOD_LINE_BIAS_DISABLED);
    }

    // Configurer la détection d'événements (both edges)
    gpiod_line_settings_set_edge_detection(ctx->line_settings, GPIOD_LINE_EDGE_BOTH);

    // Ajouter les settings à la config pour cette ligne spécifique
    int ret = gpiod_line_config_add_line_settings(ctx->line_cfg, &ctx->offset, 1, ctx->line_settings);
    if (ret < 0) {
        gpiod_line_settings_free(ctx->line_settings);
        gpiod_line_config_free(ctx->line_cfg);
        gpiod_request_config_free(ctx->req_cfg);
        gpiod_chip_close(ctx->chip);
        free(ctx);
        napi_throw_error(env, NULL, "Failed to add line settings");
        return NULL;
    }

    // Configurer le consumer
    gpiod_request_config_set_consumer(ctx->req_cfg, "nodejs-gpio");

    // Demander la ligne
    ctx->request = gpiod_chip_request_lines(ctx->chip, ctx->req_cfg, ctx->line_cfg);
    if (!ctx->request) {
        gpiod_line_settings_free(ctx->line_settings);
        gpiod_line_config_free(ctx->line_cfg);
        gpiod_request_config_free(ctx->req_cfg);
        gpiod_chip_close(ctx->chip);
        free(ctx);
        napi_throw_error(env, NULL, "Failed to request line as input (v2)");
        return NULL;
    }
#else
    ctx->chip = gpiod_chip_open(chip_name);
    if (!ctx->chip) {
        free(ctx);
        napi_throw_error(env, NULL, "Failed to open GPIO chip (v1)");
        return NULL;
    }

    ctx->line = gpiod_chip_get_line(ctx->chip, line_num);
    if (!ctx->line) {
        gpiod_chip_close(ctx->chip);
        free(ctx);
        napi_throw_error(env, NULL, "Failed to get GPIO line");
        return NULL;
    }

    // Configurer les flags pour libgpiod 1.x
    int flags = 0;
    if (strcmp(bias_str, "pull-up") == 0) {
        flags = GPIOD_LINE_REQUEST_FLAG_BIAS_PULL_UP;
    } else if (strcmp(bias_str, "pull-down") == 0) {
        flags = GPIOD_LINE_REQUEST_FLAG_BIAS_PULL_DOWN;
    } else {
        flags = GPIOD_LINE_REQUEST_FLAG_BIAS_DISABLE;
    }

    // Requête avec événements (both edges)
    int ret = gpiod_line_request_both_edges_events_flags(ctx->line, "nodejs-gpio", flags);
    if (ret < 0) {
        // Si gpiod_line_request_both_edges_events_flags n'existe pas (libgpiod < 1.5),
        // essayer sans flags
        ret = gpiod_line_request_both_edges_events(ctx->line, "nodejs-gpio");
        if (ret < 0) {
            gpiod_chip_close(ctx->chip);
            free(ctx);
            napi_throw_error(env, NULL, "Failed to request line as input with events (v1)");
            return NULL;
        }
    }
#endif

    napi_value external;
    status = napi_create_external(env, ctx, finalize_gpio, NULL, &external);
    if (status != napi_ok) {
        finalize_gpio(env, ctx, NULL);
        napi_throw_error(env, NULL, "Failed to create external");
        return NULL;
    }

    return external;
}

// Thread de monitoring des événements
static void* monitor_thread_func(void* arg) {
    gpio_context_t *ctx = (gpio_context_t*)arg;

#ifdef LIBGPIOD_V2
    struct gpiod_edge_event_buffer *event_buffer = gpiod_edge_event_buffer_new(1);
    if (!event_buffer) return NULL;

    while (ctx->is_monitoring && !ctx->is_closed) {
        // Timeout de 100ms (100000000 nanosecondes)
        int ret = gpiod_line_request_wait_edge_events(ctx->request, 100000000);
        if (ret > 0) {
            ret = gpiod_line_request_read_edge_events(ctx->request, event_buffer, 1);
            if (ret > 0) {
                struct gpiod_edge_event *event = gpiod_edge_event_buffer_get_event(event_buffer, 0);
                if (event) {
                    enum gpiod_edge_event_type edge_type = gpiod_edge_event_get_event_type(event);

                    // Créer les données à passer au callback JavaScript
                    int *data = (int*)malloc(sizeof(int));
                    if (data) {
                        *data = (edge_type == GPIOD_EDGE_EVENT_RISING_EDGE) ? 1 : 0;
                        napi_call_threadsafe_function(ctx->tsfn, data, napi_tsfn_blocking);
                    }
                }
            }
        } else if (ret < 0 && ret != -ETIMEDOUT) {
            // Erreur autre que timeout
            break;
        }
    }

    gpiod_edge_event_buffer_free(event_buffer);
#else
    struct gpiod_line_event event;
    struct timespec timeout;
    timeout.tv_sec = 0;
    timeout.tv_nsec = 100000000; // 100ms

    while (ctx->is_monitoring && !ctx->is_closed) {
        int ret = gpiod_line_event_wait(ctx->line, &timeout);
        if (ret > 0) {
            ret = gpiod_line_event_read(ctx->line, &event);
            if (ret == 0) {
                int *data = (int*)malloc(sizeof(int));
                if (data) {
                    *data = (event.event_type == GPIOD_LINE_EVENT_RISING_EDGE) ? 1 : 0;
                    napi_call_threadsafe_function(ctx->tsfn, data, napi_tsfn_blocking);
                }
            }
        }
    }
#endif

    return NULL;
}

// Callback appelé depuis le thread JavaScript
static void call_js_callback(napi_env env, napi_value js_callback, void* context, void* data) {
    if (data == NULL) {
        return;
    }

    int *edge = (int*)data;

    if (env != NULL && js_callback != NULL) {
        napi_value argv[1];
        napi_status status = napi_create_int32(env, *edge, &argv[0]);

        if (status == napi_ok) {
            napi_value global;
            status = napi_get_global(env, &global);

            if (status == napi_ok) {
                napi_value result;
                napi_call_function(env, global, js_callback, 1, argv, &result);
            }
        }
    }

    free(data);
}

// Fonction: startMonitoring(handle, callback)
static napi_value StartMonitoring(napi_env env, napi_callback_info info) {
    napi_status status;
    size_t argc = 2;
    napi_value args[2];
    gpio_context_t *ctx = NULL;

    status = napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    if (status != napi_ok || argc < 2) {
        napi_throw_error(env, NULL, "Expected handle and callback arguments");
        return NULL;
    }

    status = napi_get_value_external(env, args[0], (void**)&ctx);
    if (status != napi_ok || ctx == NULL) {
        napi_throw_error(env, NULL, "Invalid GPIO handle");
        return NULL;
    }

    if (ctx->is_closed) {
        napi_throw_error(env, NULL, "GPIO handle has been closed");
        return NULL;
    }

    if (ctx->is_output) {
        napi_throw_error(env, NULL, "Cannot monitor output GPIO");
        return NULL;
    }

    if (ctx->is_monitoring) {
        napi_throw_error(env, NULL, "Monitoring already started");
        return NULL;
    }

    // Créer une threadsafe function
    napi_value async_resource_name;
    napi_create_string_utf8(env, "GPIOMonitor", NAPI_AUTO_LENGTH, &async_resource_name);

    status = napi_create_threadsafe_function(
        env,
        args[1],
        NULL,
        async_resource_name,
        0,
        1,
        NULL,
        NULL,
        ctx,
        call_js_callback,
        &ctx->tsfn
    );

    if (status != napi_ok) {
        napi_throw_error(env, NULL, "Failed to create threadsafe function");
        return NULL;
    }

    // Démarrer le thread de monitoring
    ctx->is_monitoring = 1;
    if (pthread_create(&ctx->monitor_thread, NULL, monitor_thread_func, ctx) != 0) {
        ctx->is_monitoring = 0;
        napi_release_threadsafe_function(ctx->tsfn, napi_tsfn_release);
        ctx->tsfn = NULL;
        napi_throw_error(env, NULL, "Failed to create monitor thread");
        return NULL;
    }

    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// Fonction: stopMonitoring(handle)
static napi_value StopMonitoring(napi_env env, napi_callback_info info) {
    napi_status status;
    size_t argc = 1;
    napi_value args[1];
    gpio_context_t *ctx = NULL;

    status = napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    if (status != napi_ok || argc < 1) {
        napi_throw_error(env, NULL, "Expected handle argument");
        return NULL;
    }

    status = napi_get_value_external(env, args[0], (void**)&ctx);
    if (status != napi_ok || ctx == NULL) {
        napi_value result;
        napi_get_undefined(env, &result);
        return result;
    }

    if (ctx->is_monitoring) {
        ctx->is_monitoring = 0;
        if (ctx->monitor_thread) {
            pthread_join(ctx->monitor_thread, NULL);
            ctx->monitor_thread = 0;
        }

        if (ctx->tsfn) {
            napi_release_threadsafe_function(ctx->tsfn, napi_tsfn_abort);
            ctx->tsfn = NULL;
        }
    }

    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// Fonction: write(handle, value)
static napi_value Write(napi_env env, napi_callback_info info) {
    napi_status status;
    size_t argc = 2;
    napi_value args[2];
    gpio_context_t *ctx;
    int value;

    status = napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    if (status != napi_ok || argc < 2) {
        napi_throw_error(env, NULL, "Expected handle and value arguments");
        return NULL;
    }

    status = napi_get_value_external(env, args[0], (void**)&ctx);
    if (status != napi_ok || !ctx) {
        napi_throw_error(env, NULL, "Invalid GPIO handle");
        return NULL;
    }

    if (ctx->is_closed) {
        napi_throw_error(env, NULL, "GPIO handle has been closed");
        return NULL;
    }

    if (!ctx->is_output) {
        napi_throw_error(env, NULL, "GPIO line is not configured as output");
        return NULL;
    }

    status = napi_get_value_int32(env, args[1], &value);
    if (status != napi_ok) {
        napi_throw_error(env, NULL, "Invalid value");
        return NULL;
    }

#ifdef LIBGPIOD_V2
    enum gpiod_line_value gpio_value = value ? GPIOD_LINE_VALUE_ACTIVE : GPIOD_LINE_VALUE_INACTIVE;
    int ret = gpiod_line_request_set_value(ctx->request, ctx->offset, gpio_value);
#else
    int ret = gpiod_line_set_value(ctx->line, value ? 1 : 0);
#endif

    if (ret < 0) {
        napi_throw_error(env, NULL, "Failed to set GPIO value");
        return NULL;
    }

    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// Fonction: read(handle)
static napi_value Read(napi_env env, napi_callback_info info) {
    napi_status status;
    size_t argc = 1;
    napi_value args[1];
    gpio_context_t *ctx;

    status = napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    if (status != napi_ok || argc < 1) {
        napi_throw_error(env, NULL, "Expected handle argument");
        return NULL;
    }

    status = napi_get_value_external(env, args[0], (void**)&ctx);
    if (status != napi_ok || !ctx) {
        napi_throw_error(env, NULL, "Invalid GPIO handle");
        return NULL;
    }

    if (ctx->is_closed) {
        napi_throw_error(env, NULL, "GPIO handle has been closed");
        return NULL;
    }

#ifdef LIBGPIOD_V2
    enum gpiod_line_value gpio_value = gpiod_line_request_get_value(ctx->request, ctx->offset);
    if (gpio_value == GPIOD_LINE_VALUE_ERROR) {
        napi_throw_error(env, NULL, "Failed to read GPIO value (v2)");
        return NULL;
    }
    int value = (gpio_value == GPIOD_LINE_VALUE_ACTIVE) ? 1 : 0;
#else
    int value = gpiod_line_get_value(ctx->line);
    if (value < 0) {
        napi_throw_error(env, NULL, "Failed to read GPIO value (v1)");
        return NULL;
    }
#endif

    napi_value result;
    status = napi_create_int32(env, value, &result);
    if (status != napi_ok) {
        napi_throw_error(env, NULL, "Failed to create return value");
        return NULL;
    }

    return result;
}

// Fonction: close(handle)
static napi_value Close(napi_env env, napi_callback_info info) {
    napi_status status;
    size_t argc = 1;
    napi_value args[1];
    gpio_context_t *ctx = NULL;

    status = napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    if (status != napi_ok || argc < 1) {
        napi_throw_error(env, NULL, "Expected handle argument");
        return NULL;
    }

    status = napi_get_value_external(env, args[0], (void**)&ctx);
    if (status != napi_ok || ctx == NULL) {
        napi_value result;
        napi_get_undefined(env, &result);
        return result;
    }

    if (ctx->is_closed) {
        napi_value result;
        napi_get_undefined(env, &result);
        return result;
    }

    // Arrêter le monitoring si actif
    if (ctx->is_monitoring) {
        ctx->is_monitoring = 0;
        if (ctx->monitor_thread) {
            pthread_join(ctx->monitor_thread, NULL);
            ctx->monitor_thread = 0;
        }

        if (ctx->tsfn) {
            napi_release_threadsafe_function(ctx->tsfn, napi_tsfn_abort);
            ctx->tsfn = NULL;
        }
    }

#ifdef LIBGPIOD_V2
    if (ctx->request) {
        gpiod_line_request_release(ctx->request);
        ctx->request = NULL;
    }
    if (ctx->line_settings) {
        gpiod_line_settings_free(ctx->line_settings);
        ctx->line_settings = NULL;
    }
    if (ctx->line_cfg) {
        gpiod_line_config_free(ctx->line_cfg);
        ctx->line_cfg = NULL;
    }
    if (ctx->req_cfg) {
        gpiod_request_config_free(ctx->req_cfg);
        ctx->req_cfg = NULL;
    }
    if (ctx->chip) {
        gpiod_chip_close(ctx->chip);
        ctx->chip = NULL;
    }
#else
    if (ctx->line) {
        gpiod_line_release(ctx->line);
        ctx->line = NULL;
    }
    if (ctx->chip) {
        gpiod_chip_close(ctx->chip);
        ctx->chip = NULL;
    }
#endif

    ctx->is_closed = 1;

    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// Initialisation du module
static napi_value Init(napi_env env, napi_value exports) {
    napi_status status;
    napi_value fn;

    status = napi_create_function(env, NULL, 0, GetVersion, NULL, &fn);
    if (status == napi_ok) {
        napi_set_named_property(env, exports, "getVersion", fn);
    }

    status = napi_create_function(env, NULL, 0, OpenOutput, NULL, &fn);
    if (status == napi_ok) {
        napi_set_named_property(env, exports, "openOutput", fn);
    }

    status = napi_create_function(env, NULL, 0, OpenInput, NULL, &fn);
    if (status == napi_ok) {
        napi_set_named_property(env, exports, "openInput", fn);
    }

    status = napi_create_function(env, NULL, 0, Write, NULL, &fn);
    if (status == napi_ok) {
        napi_set_named_property(env, exports, "write", fn);
    }

    status = napi_create_function(env, NULL, 0, Read, NULL, &fn);
    if (status == napi_ok) {
        napi_set_named_property(env, exports, "read", fn);
    }

    status = napi_create_function(env, NULL, 0, StartMonitoring, NULL, &fn);
    if (status == napi_ok) {
        napi_set_named_property(env, exports, "startMonitoring", fn);
    }

    status = napi_create_function(env, NULL, 0, StopMonitoring, NULL, &fn);
    if (status == napi_ok) {
        napi_set_named_property(env, exports, "stopMonitoring", fn);
    }

    status = napi_create_function(env, NULL, 0, Close, NULL, &fn);
    if (status == napi_ok) {
        napi_set_named_property(env, exports, "close", fn);
    }

    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
