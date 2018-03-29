FROM mhart/alpine-node:8
WORKDIR /test
ADD . /test/
RUN yarn