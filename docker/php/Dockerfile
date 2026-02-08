FROM php:8.2-fpm

# 必要なPHP拡張をインストール
RUN docker-php-ext-install pdo pdo_mysql

# 作業ディレクトリ
WORKDIR /var/www/html

# php.ini設定
RUN echo "display_errors = On" >> /usr/local/etc/php/conf.d/error.ini \
    && echo "error_reporting = E_ALL" >> /usr/local/etc/php/conf.d/error.ini \
    && echo "date.timezone = Asia/Tokyo" >> /usr/local/etc/php/conf.d/timezone.ini

EXPOSE 9000
